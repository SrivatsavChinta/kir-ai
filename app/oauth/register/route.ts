import { applyCors, oauthError, preflight } from "@/lib/mcp/http";
import { registerClient } from "@/lib/mcp/oauth/flow";
import { createSupabaseOAuthStore } from "@/lib/mcp/oauth/supabase-store";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return oauthError(400, "invalid_client_metadata", "Registration must be JSON.");
  }
  const registered = registerClient(body);
  if (!registered.ok) return oauthError(registered.status, registered.error, registered.description);
  try {
    await createSupabaseOAuthStore().saveClient(registered.client);
  } catch (error) {
    console.error("OAuth client registration failed", error);
    return oauthError(500, "server_error", "kir.ai couldn't store the client registration.");
  }
  const client = registered.client;
  return applyCors(
    Response.json(
      {
        client_id: client.id,
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      },
      { status: 201 },
    ),
  );
}

export function OPTIONS() {
  return preflight();
}
