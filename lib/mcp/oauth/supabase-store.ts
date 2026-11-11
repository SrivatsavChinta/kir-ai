import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AuthCodeRecord,
  GrantRecord,
  GrantSummary,
  OAuthClientRecord,
  OAuthStore,
} from "@/lib/mcp/oauth/types";

type ClientRow = {
  id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: "none";
};

type CodeRow = {
  code_hash: string;
  client_id: string;
  client_label: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: "S256";
  scope: string;
  resource: string | null;
  supabase_refresh_encrypted: string;
  expires_at: string;
  consumed_at: string | null;
};

type GrantRow = {
  id: string;
  client_id: string;
  client_label: string;
  user_id: string;
  scope: string;
  resource: string | null;
  access_token_hash: string | null;
  access_expires_at: string | null;
  refresh_token_hash: string | null;
  refresh_expires_at: string | null;
  supabase_refresh_encrypted: string;
  supabase_access_encrypted: string | null;
  supabase_access_expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

/**
 * OAuth state lives in tables with no authenticated policies. This client is
 * the service role and is used only for those tables, never for portfolio rows.
 */
export function createSupabaseOAuthStore(): OAuthStore {
  const db = createAdminClient();

  return {
    async saveClient(client) {
      const { error } = await db.from("oauth_clients").insert({
        id: client.id,
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      });
      if (error) throw error;
    },
    async getClient(id) {
      const { data, error } = await db.from("oauth_clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapClient(data as ClientRow) : null;
    },
    async saveCode(code) {
      const { error } = await db.from("oauth_authorization_codes").insert({
        code_hash: code.codeHash,
        client_id: code.clientId,
        client_label: code.clientLabel,
        user_id: code.userId,
        redirect_uri: code.redirectUri,
        code_challenge: code.codeChallenge,
        code_challenge_method: code.codeChallengeMethod,
        scope: code.scope,
        resource: code.resource,
        supabase_refresh_encrypted: code.supabaseRefreshEncrypted,
        expires_at: code.expiresAt,
      });
      if (error) throw error;
    },
    async consumeCode(codeHash, now) {
      const { data, error } = await db
        .from("oauth_authorization_codes")
        .update({ consumed_at: now.toISOString() })
        .eq("code_hash", codeHash)
        .is("consumed_at", null)
        .gt("expires_at", now.toISOString())
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? mapCode(data as CodeRow) : null;
    },
    async saveGrant(grant) {
      const { error } = await db.from("oauth_grants").insert(grantToRow(grant));
      if (error) throw error;
    },
    async getGrant(id) {
      const { data, error } = await db.from("oauth_grants").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapGrant(data as GrantRow) : null;
    },
    async getGrantByAccessHash(hash) {
      return oneGrant(db, "access_token_hash", hash);
    },
    async getGrantByRefreshHash(hash) {
      return oneGrant(db, "refresh_token_hash", hash);
    },
    async rotateTokens(id, expectedRefreshHash, next) {
      const { data, error } = await db
        .from("oauth_grants")
        .update({
          access_token_hash: next.accessTokenHash,
          access_expires_at: next.accessExpiresAt,
          refresh_token_hash: next.refreshTokenHash,
          refresh_expires_at: next.refreshExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("refresh_token_hash", expectedRefreshHash)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async saveSupabaseSession(id, expectedRefreshEncrypted, next) {
      const { data, error } = await db
        .from("oauth_grants")
        .update({
          supabase_refresh_encrypted: next.supabaseRefreshEncrypted,
          supabase_access_encrypted: next.supabaseAccessEncrypted,
          supabase_access_expires_at: next.supabaseAccessExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("supabase_refresh_encrypted", expectedRefreshEncrypted)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async listGrants(userId) {
      const { data, error } = await db
        .from("oauth_grants")
        .select("id, client_label, created_at, refresh_expires_at")
        .eq("user_id", userId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Pick<GrantRow, "id" | "client_label" | "created_at" | "refresh_expires_at">[]).map(
        (row): GrantSummary => ({
          id: row.id,
          clientLabel: row.client_label,
          createdAt: row.created_at,
          refreshExpiresAt: row.refresh_expires_at,
        }),
      );
    },
    async revokeGrant(id, userId) {
      const { data, error } = await db
        .from("oauth_grants")
        .update(revokedPatch())
        .eq("id", id)
        .eq("user_id", userId)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async revokeByTokenHash(hash) {
      const grant = (await oneGrant(db, "access_token_hash", hash)) ?? (await oneGrant(db, "refresh_token_hash", hash));
      if (!grant) return false;
      const { error } = await db.from("oauth_grants").update(revokedPatch()).eq("id", grant.id).is("revoked_at", null);
      if (error) throw error;
      return true;
    },
  };
}

async function oneGrant(
  db: ReturnType<typeof createAdminClient>,
  column: "access_token_hash" | "refresh_token_hash",
  hash: string,
): Promise<GrantRecord | null> {
  const { data, error } = await db
    .from("oauth_grants")
    .select("*")
    .eq(column, hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? mapGrant(data as GrantRow) : null;
}

function mapClient(row: ClientRow): OAuthClientRecord {
  return {
    id: row.id,
    name: row.client_name,
    redirectUris: row.redirect_uris,
    grantTypes: row.grant_types,
    responseTypes: row.response_types,
    tokenEndpointAuthMethod: "none",
  };
}

function mapCode(row: CodeRow): AuthCodeRecord {
  return {
    codeHash: row.code_hash,
    clientId: row.client_id,
    clientLabel: row.client_label,
    userId: row.user_id,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    codeChallengeMethod: "S256",
    scope: row.scope,
    resource: row.resource,
    supabaseRefreshEncrypted: row.supabase_refresh_encrypted,
    expiresAt: row.expires_at,
  };
}

function mapGrant(row: GrantRow): GrantRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    clientLabel: row.client_label,
    userId: row.user_id,
    scope: row.scope,
    resource: row.resource,
    accessTokenHash: row.access_token_hash,
    accessExpiresAt: row.access_expires_at,
    refreshTokenHash: row.refresh_token_hash,
    refreshExpiresAt: row.refresh_expires_at,
    supabaseRefreshEncrypted: row.supabase_refresh_encrypted,
    supabaseAccessEncrypted: row.supabase_access_encrypted,
    supabaseAccessExpiresAt: row.supabase_access_expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

function grantToRow(grant: GrantRecord) {
  return {
    id: grant.id,
    client_id: grant.clientId,
    client_label: grant.clientLabel,
    user_id: grant.userId,
    scope: grant.scope,
    resource: grant.resource,
    access_token_hash: grant.accessTokenHash,
    access_expires_at: grant.accessExpiresAt,
    refresh_token_hash: grant.refreshTokenHash,
    refresh_expires_at: grant.refreshExpiresAt,
    supabase_refresh_encrypted: grant.supabaseRefreshEncrypted,
    supabase_access_encrypted: grant.supabaseAccessEncrypted,
    supabase_access_expires_at: grant.supabaseAccessExpiresAt,
    revoked_at: grant.revokedAt,
    created_at: grant.createdAt,
  };
}

function revokedPatch() {
  return {
    revoked_at: new Date().toISOString(),
    access_token_hash: null,
    refresh_token_hash: null,
    supabase_refresh_encrypted: "",
    supabase_access_encrypted: null,
    supabase_access_expires_at: null,
    updated_at: new Date().toISOString(),
  };
}
