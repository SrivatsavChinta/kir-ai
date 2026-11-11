import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Actor } from "@/lib/data/actor";
import { handleMcpRequest } from "@/lib/mcp/handler";
import { acceptedRedirect, redirectProblem, type ResolvedClient } from "@/lib/mcp/oauth/clients";
import { isAllowedRedirect, redirectMatches, verifyPkce } from "@/lib/mcp/pkce";
import { createMemoryOAuthStore } from "@/lib/mcp/oauth/memory-store";
import { createAuthorizationCode, exchangeAuthorizationCode, refreshAccessToken, registerClient } from "@/lib/mcp/oauth/flow";
import { authorizationServerMetadata, protectedResourceMetadata } from "@/lib/mcp/oauth/metadata";
import { createHash, randomBytes } from "node:crypto";

import { createMemoryPortfolio } from "./memory-portfolio";

const ENDPOINT = "https://kirai.example/api/mcp";

function rpc(method: string, params: unknown, id = 1, token?: string) {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

async function parseRpc(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .at(-1);
    return data ? (JSON.parse(data) as Record<string, unknown>) : {};
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function authenticator(actors: Record<string, Actor>) {
  return async (request: Request) => {
    const header = request.headers.get("authorization") ?? "";
    const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
    const actor = token ? actors[token] : undefined;
    if (!actor) return null;
    return { actor, clientId: "test", scopes: ["portfolio"], expiresAt: Math.floor(Date.now() / 1000) + 3600 };
  };
}

describe("MCP protocol", () => {
  it("rejects an unauthenticated request with a discovery challenge", async () => {
    const response = await handleMcpRequest(rpc("initialize", {}), async () => null);
    assert.equal(response.status, 401);
    const challenge = response.headers.get("www-authenticate") ?? "";
    assert.match(challenge, /resource_metadata="https:\/\/kirai\.example\/\.well-known\/oauth-protected-resource\/api\/mcp"/);
    const body = await parseRpc(response);
    assert.equal(body.error, "invalid_token");
  });

  it("initializes and lists the rental tools for an authenticated landlord", async () => {
    const portfolio = createMemoryPortfolio();
    const auth = authenticator({ landlord: portfolio.actor("landlord-a") });
    const initialized = await handleMcpRequest(
      rpc("initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      }, 1, "landlord"),
      auth,
    );
    assert.equal(initialized.status, 200);
    const handshake = await parseRpc(initialized);
    const result = handshake.result as { serverInfo?: { name?: string }; capabilities?: unknown };
    assert.equal(result.serverInfo?.name, "kir-ai");
    assert.ok(result.capabilities);

    const listed = await handleMcpRequest(rpc("tools/list", {}, 2, "landlord"), auth);
    assert.equal(listed.status, 200);
    const tools = await parseRpc(listed);
    const names = ((tools.result as { tools: { name: string }[] }).tools ?? []).map((tool) => tool.name);
    for (const name of [
      "list_properties",
      "get_property",
      "create_property",
      "update_property",
      "create_tenant",
      "create_tenancy",
      "record_rent_payment",
      "create_maintenance_request",
      "update_maintenance_status",
      "list_documents",
      "list_rent_obligations",
    ]) {
      assert.ok(names.includes(name), `missing tool ${name}`);
    }
  });
});

describe("MCP property tools", () => {
  it("creates, reads and updates a property, and hides it from another landlord", async () => {
    const portfolio = createMemoryPortfolio();
    const auth = authenticator({
      a: portfolio.actor("landlord-a", "a@example.com"),
      b: portfolio.actor("landlord-b", "b@example.com"),
    });

    const created = await handleMcpRequest(
      rpc(
        "tools/call",
        {
          name: "create_property",
          arguments: {
            name: "Whitefield Residency",
            propertyType: "Apartment Building",
            address: "12 Whitefield Main Road",
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560066",
            description: "Two-bedroom apartments",
          },
        },
        1,
        "a",
      ),
      auth,
    );
    const createdBody = await parseRpc(created);
    const createdResult = createdBody.result as { isError?: boolean; structuredContent?: { property?: { id: string; name: string } } };
    assert.notEqual(createdResult.isError, true);
    const propertyId = createdResult.structuredContent?.property?.id;
    assert.ok(propertyId);

    const read = await handleMcpRequest(
      rpc("tools/call", { name: "get_property", arguments: { propertyId } }, 2, "a"),
      auth,
    );
    const readBody = await parseRpc(read);
    const readResult = readBody.result as { structuredContent?: { property?: { name: string } } };
    assert.equal(readResult.structuredContent?.property?.name, "Whitefield Residency");

    const updated = await handleMcpRequest(
      rpc(
        "tools/call",
        { name: "update_property", arguments: { propertyId, city: "Mysuru" } },
        3,
        "a",
      ),
      auth,
    );
    const updatedBody = await parseRpc(updated);
    const updatedResult = updatedBody.result as { isError?: boolean; structuredContent?: { property?: { city: string } } };
    assert.notEqual(updatedResult.isError, true);
    assert.equal(updatedResult.structuredContent?.property?.city, "Mysuru");

    const { readPortfolioSlice } = await import("@/lib/data/workspace");
    const { runAsActor } = await import("@/lib/data/actor");
    const application = await runAsActor(portfolio.actor("landlord-a"), () => readPortfolioSlice(portfolio.actor("landlord-a").supabase));
    assert.equal(application.ok, true);
    if (application.ok) {
      assert.equal(application.properties.find((property) => property.id === propertyId)?.city, "Mysuru");
    }

    const hidden = await handleMcpRequest(
      rpc("tools/call", { name: "get_property", arguments: { propertyId } }, 4, "b"),
      auth,
    );
    const hiddenBody = await parseRpc(hidden);
    const hiddenResult = hiddenBody.result as { isError?: boolean };
    assert.equal(hiddenResult.isError, true);

    const stolen = await handleMcpRequest(
      rpc("tools/call", { name: "update_property", arguments: { propertyId, name: "Stolen" } }, 5, "b"),
      auth,
    );
    const stolenBody = await parseRpc(stolen);
    assert.equal((stolenBody.result as { isError?: boolean }).isError, true);
    const still = portfolio.rows("properties").find((row) => row.id === propertyId);
    assert.equal(still?.name, "Whitefield Residency");
    assert.equal(still?.city, "Mysuru");
  });

  it("rejects invalid property input and a supplied landlord id", async () => {
    const portfolio = createMemoryPortfolio();
    const auth = authenticator({ a: portfolio.actor("landlord-a") });
    const invalid = await handleMcpRequest(
      rpc(
        "tools/call",
        {
          name: "create_property",
          arguments: {
            name: "A",
            propertyType: "Villa",
            address: "12 Whitefield Main Road",
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560066",
          },
        },
        1,
        "a",
      ),
      auth,
    );
    const invalidBody = await parseRpc(invalid);
    const invalidResult = invalidBody.result as { isError?: boolean; content?: { text: string }[] };
    assert.equal(invalidResult.isError, true);
    assert.match(invalidResult.content?.[0]?.text ?? "", /at least 2 characters/);
    assert.equal(portfolio.rows("properties").length, 0);

    const injected = await handleMcpRequest(
      rpc(
        "tools/call",
        {
          name: "create_property",
          arguments: {
            landlord_id: "landlord-b",
            name: "Injected",
            propertyType: "Villa",
            address: "12 Whitefield Main Road",
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560066",
          },
        },
        2,
        "a",
      ),
      auth,
    );
    const injectedBody = await parseRpc(injected);
    const failed = Boolean(injectedBody.error) || (injectedBody.result as { isError?: boolean } | undefined)?.isError === true;
    assert.equal(failed, true);
    assert.equal(portfolio.rows("properties").length, 0);
  });
});

describe("OAuth", () => {
  it("publishes the metadata Claude's connector looks up", () => {
    const origin = "https://kirai.example";
    const resource = protectedResourceMetadata(origin);
    assert.equal(resource.resource, "https://kirai.example/api/mcp");
    assert.deepEqual(resource.authorization_servers, [origin]);
    const server = authorizationServerMetadata(origin);
    assert.equal(server.registration_endpoint, "https://kirai.example/oauth/register");
    assert.equal(server.code_challenge_methods_supported[0], "S256");
    assert.equal(server.client_id_metadata_document_supported, true);
    assert.ok(server.token_endpoint_auth_methods_supported.includes("none"));
  });

  it("accepts Claude's redirect and loopback ports, and rejects other redirects", () => {
    assert.equal(isAllowedRedirect("https://claude.ai/api/mcp/auth_callback"), true);
    assert.equal(isAllowedRedirect("https://claude.com/api/mcp/auth_callback"), true);
    assert.equal(isAllowedRedirect("https://evil.example/callback"), false);
    assert.equal(isAllowedRedirect("https://claude.ai.evil.example/api/mcp/auth_callback"), false);
    assert.equal(isAllowedRedirect("https://claude.ai/api/mcp/auth_callback.evil"), false);
    assert.equal(isAllowedRedirect("javascript:alert(1)"), false);
    assert.equal(
      redirectMatches("http://localhost/callback", "http://localhost:3118/callback"),
      true,
    );
    assert.equal(
      redirectMatches("http://127.0.0.1/callback", "http://127.0.0.1:4000/callback"),
      true,
    );
    assert.equal(redirectMatches("https://claude.ai/api/mcp/auth_callback", "https://claude.ai/api/mcp/other"), false);
  });

  it("matches the callback each published Claude client actually registers", () => {
    // Fixtures from https://claude.ai/oauth/mcp-oauth-client-metadata and
    // https://claude.ai/oauth/claude-code-client-metadata on 12 Nov 2026.
    const hosted: ResolvedClient = {
      id: "https://claude.ai/oauth/mcp-oauth-client-metadata",
      label: "claude.ai",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
    };
    const claudeCode: ResolvedClient = {
      id: "https://claude.ai/oauth/claude-code-client-metadata",
      label: "claude.ai",
      redirectUris: ["http://localhost/callback", "http://127.0.0.1/callback"],
    };
    const hostedCallback = "https://claude.ai/api/mcp/auth_callback";

    assert.equal(acceptedRedirect(hosted, hostedCallback), true);
    assert.equal(redirectProblem(hosted, "https://evil.example/callback"), "This application wants to send you to a redirect URL kir.ai does not allow.");
    assert.equal(acceptedRedirect(hosted, "https://claude.com/api/mcp/auth_callback"), false);
    assert.equal(acceptedRedirect(hosted, "https://claude.ai/api/mcp/auth_callback/"), false);

    assert.equal(acceptedRedirect(claudeCode, "http://localhost:3118/callback"), true);
    assert.equal(acceptedRedirect(claudeCode, "http://127.0.0.1:58231/callback"), true);
    assert.equal(acceptedRedirect(claudeCode, "http://localhost:3118/oauth/callback"), false);
    assert.equal(
      redirectProblem(claudeCode, hostedCallback),
      "This application did not register that callback with kir.ai.",
    );
    assert.equal(acceptedRedirect(claudeCode, "https://evil.example/callback"), false);
  });

  it("issues, refreshes and rotates an authorization-code token", async () => {
    process.env.MCP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    const store = createMemoryOAuthStore();
    const registered = registerClient({
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
    assert.equal(registered.ok, true);
    if (!registered.ok) return;
    await store.saveClient(registered.client);

    const rejected = registerClient({
      client_name: "Other",
      redirect_uris: ["https://evil.example/callback"],
    });
    assert.equal(rejected.ok, false);

    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    assert.equal(verifyPkce(verifier, challenge), true);
    const code = await createAuthorizationCode(store, {
      clientId: registered.client.id,
      clientLabel: "Claude",
      userId: "landlord-a",
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      codeChallenge: challenge,
      scope: "portfolio",
      resource: "https://kirai.example/api/mcp",
      supabaseRefreshToken: "supabase-refresh",
    });
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      client_id: registered.client.id,
      code_verifier: verifier,
      resource: "https://kirai.example/api/mcp",
    });
    const token = await exchangeAuthorizationCode(store, params, "https://kirai.example/api/mcp");
    assert.equal(token.ok, true);
    if (!token.ok) return;
    const again = await exchangeAuthorizationCode(store, params, "https://kirai.example/api/mcp");
    assert.equal(again.ok, false);

    const refreshed = await refreshAccessToken(
      store,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
        client_id: registered.client.id,
      }),
      "https://kirai.example/api/mcp",
    );
    assert.equal(refreshed.ok, true);
    if (!refreshed.ok) return;
    const reused = await refreshAccessToken(
      store,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
        client_id: registered.client.id,
      }),
      "https://kirai.example/api/mcp",
    );
    assert.equal(reused.ok, false);
    if (!reused.ok) assert.equal(reused.error, "invalid_grant");
  });
});
