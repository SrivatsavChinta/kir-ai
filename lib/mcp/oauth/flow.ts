import { randomUUID } from "node:crypto";

import { encryptSecret, randomToken, sha256 } from "@/lib/mcp/crypto";
import { isAllowedRedirect, verifyPkce } from "@/lib/mcp/pkce";
import { canonicalResource } from "@/lib/mcp/urls";
import type { OAuthClientRecord, OAuthFailure, OAuthStore, TokenSuccess } from "@/lib/mcp/oauth/types";

export const ACCESS_TOKEN_SECONDS = 60 * 60;
export const REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 30;
const CODE_SECONDS = 60;
const SCOPE = "portfolio";

export function normalizeScope(requested: string | null | undefined): string | OAuthFailure {
  const parts = (requested ?? SCOPE).split(/\s+/).filter(Boolean);
  const unknown = parts.filter((part) => part !== SCOPE && part !== "offline_access");
  if (unknown.length > 0) {
    return fail(400, "invalid_scope", `kir.ai does not grant ${unknown.join(", ")}.`);
  }
  if (!parts.includes(SCOPE) && parts.length > 0 && !parts.every((part) => part === "offline_access")) {
    return fail(400, "invalid_scope", "Request the portfolio scope.");
  }
  return SCOPE;
}

export function registerClient(
  body: unknown,
): { ok: true; client: OAuthClientRecord } | OAuthFailure {
  if (!body || typeof body !== "object") return fail(400, "invalid_client_metadata", "Registration must be a JSON object.");
  const record = body as Record<string, unknown>;
  const redirectUris = record.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.some((uri) => typeof uri !== "string")) {
    return fail(400, "invalid_client_metadata", "redirect_uris must list at least one URL.");
  }
  if (redirectUris.some((uri) => !isAllowedRedirect(uri))) {
    return fail(
      400,
      "invalid_redirect_uri",
      "kir.ai only registers https://claude.ai/api/mcp/auth_callback, https://claude.com/api/mcp/auth_callback, and loopback redirects.",
    );
  }
  const method = record.token_endpoint_auth_method ?? "none";
  if (method !== "none") {
    return fail(400, "invalid_client_metadata", "Claude must register as a public client with token_endpoint_auth_method none.");
  }
  const grants = arrayOf(record.grant_types) ?? ["authorization_code"];
  if (!grants.includes("authorization_code") || grants.some((grant) => grant !== "authorization_code" && grant !== "refresh_token")) {
    return fail(400, "invalid_client_metadata", "Supported grants are authorization_code and refresh_token.");
  }
  const responses = arrayOf(record.response_types) ?? ["code"];
  if (responses.some((response) => response !== "code")) {
    return fail(400, "invalid_client_metadata", "The only supported response type is code.");
  }
  const name = typeof record.client_name === "string" && record.client_name.trim() ? record.client_name.trim() : "MCP client";
  if (name.length > 120) return fail(400, "invalid_client_metadata", "client_name must be 120 characters or fewer.");

  return {
    ok: true,
    client: {
      id: randomUUID(),
      name,
      redirectUris: redirectUris,
      grantTypes: grants.includes("refresh_token") ? ["authorization_code", "refresh_token"] : ["authorization_code"],
      responseTypes: ["code"],
      tokenEndpointAuthMethod: "none",
    },
  };
}

export async function createAuthorizationCode(
  store: OAuthStore,
  input: {
    clientId: string;
    clientLabel: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
    scope: string;
    resource: string | null;
    supabaseRefreshToken: string;
  },
): Promise<string> {
  const code = randomToken();
  await store.saveCode({
    codeHash: sha256(code),
    clientId: input.clientId,
    clientLabel: input.clientLabel,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: "S256",
    scope: input.scope,
    resource: input.resource,
    supabaseRefreshEncrypted: encryptSecret(input.supabaseRefreshToken),
    expiresAt: new Date(Date.now() + CODE_SECONDS * 1000).toISOString(),
  });
  return code;
}

export async function exchangeAuthorizationCode(
  store: OAuthStore,
  params: URLSearchParams,
  expectedResource: string,
): Promise<TokenSuccess | OAuthFailure> {
  const code = params.get("code") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const clientId = params.get("client_id") ?? "";
  const verifier = params.get("code_verifier") ?? "";
  if (!code || !redirectUri || !clientId || !verifier) {
    return fail(400, "invalid_request", "code, redirect_uri, client_id and code_verifier are required.");
  }
  const resourceError = checkResource(params.get("resource"), expectedResource);
  if (resourceError) return resourceError;
  if (params.get("client_secret")) return fail(401, "invalid_client", "kir.ai clients do not use a client secret.");

  const stored = await store.consumeCode(sha256(code), new Date());
  if (!stored) return fail(400, "invalid_grant", "That authorization code is invalid, expired or already used.");
  if (stored.clientId !== clientId || stored.redirectUri !== redirectUri) {
    return fail(400, "invalid_grant", "The client or redirect URL does not match the authorization request.");
  }
  if (!verifyPkce(verifier, stored.codeChallenge)) {
    return fail(400, "invalid_grant", "The PKCE code verifier does not match.");
  }
  return issue(store, stored);
}

export async function refreshAccessToken(
  store: OAuthStore,
  params: URLSearchParams,
  expectedResource: string,
): Promise<TokenSuccess | OAuthFailure> {
  const refreshToken = params.get("refresh_token") ?? "";
  const clientId = params.get("client_id") ?? "";
  if (!refreshToken || !clientId) return fail(400, "invalid_request", "refresh_token and client_id are required.");
  const resourceError = checkResource(params.get("resource"), expectedResource);
  if (resourceError) return resourceError;
  if (params.get("client_secret")) return fail(401, "invalid_client", "kir.ai clients do not use a client secret.");

  const grant = await store.getGrantByRefreshHash(sha256(refreshToken));
  if (!grant || !grant.refreshExpiresAt || Date.parse(grant.refreshExpiresAt) <= Date.now()) {
    return fail(400, "invalid_grant", "That refresh token is no longer valid. Connect kir.ai again.");
  }
  if (grant.clientId !== clientId) return fail(400, "invalid_grant", "This refresh token was issued to a different client.");
  return issue(store, grant, grant.refreshTokenHash);
}

export async function revokeToken(store: OAuthStore, params: URLSearchParams): Promise<void> {
  const token = params.get("token");
  if (!token) return;
  await store.revokeByTokenHash(sha256(token));
}

async function issue(
  store: OAuthStore,
  source: {
    clientId: string;
    clientLabel: string;
    userId: string;
    scope: string;
    resource: string | null;
    supabaseRefreshEncrypted: string;
  },
  previousRefreshHash?: string | null,
): Promise<TokenSuccess | OAuthFailure> {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = Date.now();
  const accessExpiresAt = new Date(now + ACCESS_TOKEN_SECONDS * 1000).toISOString();
  const refreshExpiresAt = new Date(now + REFRESH_TOKEN_SECONDS * 1000).toISOString();
  const next = {
    accessTokenHash: sha256(accessToken),
    accessExpiresAt,
    refreshTokenHash: sha256(refreshToken),
    refreshExpiresAt,
  };

  if (previousRefreshHash) {
    const grant = await store.getGrantByRefreshHash(previousRefreshHash);
    if (!grant) return fail(400, "invalid_grant", "That refresh token is no longer valid. Connect kir.ai again.");
    const rotated = await store.rotateTokens(grant.id, previousRefreshHash, next);
    if (!rotated) return fail(400, "invalid_grant", "That refresh token was already used. Connect kir.ai again.");
  } else {
    await store.saveGrant({
      id: randomUUID(),
      clientId: source.clientId,
      clientLabel: source.clientLabel,
      userId: source.userId,
      scope: source.scope,
      resource: source.resource,
      supabaseRefreshEncrypted: source.supabaseRefreshEncrypted,
      supabaseAccessEncrypted: null,
      supabaseAccessExpiresAt: null,
      revokedAt: null,
      createdAt: new Date(now).toISOString(),
      ...next,
    });
  }

  return {
    ok: true,
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_SECONDS,
    refresh_token: refreshToken,
    scope: source.scope,
  };
}

function checkResource(resource: string | null, expected: string): OAuthFailure | null {
  if (!resource) return null;
  if (canonicalResource(resource) !== canonicalResource(expected)) {
    return fail(400, "invalid_target", "The resource does not match this kir.ai connector.");
  }
  return null;
}

function arrayOf(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value;
}

function fail(status: number, error: string, description: string): OAuthFailure {
  return { ok: false, status, error, description };
}
