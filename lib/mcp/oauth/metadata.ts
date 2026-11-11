import { mcpResourceUrl, protectedResourceMetadataUrl } from "@/lib/mcp/urls";

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: ["portfolio"],
    bearer_methods_supported: ["header"],
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["portfolio", "offline_access"],
    client_id_metadata_document_supported: true,
    resource_metadata: protectedResourceMetadataUrl(origin),
  };
}
