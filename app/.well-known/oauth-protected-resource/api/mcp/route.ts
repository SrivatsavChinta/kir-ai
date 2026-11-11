import { applyCors, preflight } from "@/lib/mcp/http";
import { protectedResourceMetadata } from "@/lib/mcp/oauth/metadata";
import { requestOrigin } from "@/lib/mcp/urls";

/** Path-suffixed metadata. Clients try this first when the MCP URL is /api/mcp. */
export function GET(request: Request) {
  return applyCors(Response.json(protectedResourceMetadata(requestOrigin(request))));
}

export function OPTIONS() {
  return preflight();
}
