import { applyCors, preflight } from "@/lib/mcp/http";
import { authorizationServerMetadata } from "@/lib/mcp/oauth/metadata";
import { requestOrigin } from "@/lib/mcp/urls";

export function GET(request: Request) {
  return applyCors(Response.json(authorizationServerMetadata(requestOrigin(request))));
}

export function OPTIONS() {
  return preflight();
}
