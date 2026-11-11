import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";

import type { Actor } from "@/lib/data/actor";
import { runAsActor } from "@/lib/data/actor";
import { actorFromAccessToken, bearerToken } from "@/lib/mcp/auth";
import { applyCors, preflight, unauthorized } from "@/lib/mcp/http";
import { registerKiraiTools } from "@/lib/mcp/tools";
import { mcpResourceUrl, requestOrigin } from "@/lib/mcp/urls";

export type McpPrincipal = {
  actor: Actor;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
};

const mcp = createMcpHandler(
  () => {
    const server = new McpServer({ name: "kir-ai", version: "0.1.0" });
    registerKiraiTools(server);
    return server;
  },
);

/**
 * Stateless Streamable HTTP. Each request builds a fresh server, so the route
 * can run on Vercel without an in-memory session. Claude's 2025 handshake is
 * served by the SDK's legacy fallback; 2026-07-28 clients use the same tools.
 */
export async function handleMcpRequest(
  request: Request,
  authenticate: (request: Request) => Promise<McpPrincipal | null> = authenticateMcpRequest,
): Promise<Response> {
  if (request.method === "OPTIONS") return preflight();
  const principal = await authenticate(request);
  if (!principal) {
    return unauthorized(request, "Sign in to kir.ai to use this connector.");
  }

  const response = await runAsActor(principal.actor, () =>
    mcp.fetch(request, {
      authInfo: {
        token: bearerToken(request) ?? "",
        clientId: principal.clientId,
        scopes: principal.scopes,
        expiresAt: principal.expiresAt,
        resource: new URL(mcpResourceUrl(requestOrigin(request))),
        extra: { userId: principal.actor.userId },
      },
    }),
  );
  return applyCors(response);
}

async function authenticateMcpRequest(request: Request): Promise<McpPrincipal | null> {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const actor = await actorFromAccessToken(token);
    if (!actor) return null;
    return { actor, clientId: "kir-ai", scopes: ["portfolio"] };
  } catch (error) {
    console.error("MCP authentication failed", error);
    return null;
  }
}
