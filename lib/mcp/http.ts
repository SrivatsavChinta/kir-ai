import { protectedResourceMetadataUrl, requestOrigin } from "@/lib/mcp/urls";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "WWW-Authenticate, MCP-Protocol-Version, Mcp-Session-Id",
  "cache-control": "no-store",
};

export function applyCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function preflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers":
        "Content-Type, Authorization, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
      "access-control-max-age": "86400",
    },
  });
}

/** 401 that tells Claude where to start OAuth. A 200 with an error body does not. */
export function unauthorized(request: Request, description: string): Response {
  const metadata = protectedResourceMetadataUrl(requestOrigin(request));
  const challenge =
    `Bearer error="invalid_token", error_description="${description.replaceAll('"', "'")}", ` +
    `resource_metadata="${metadata}", scope="portfolio"`;
  return applyCors(
    Response.json(
      { error: "invalid_token", error_description: description },
      { status: 401, headers: { "WWW-Authenticate": challenge, "cache-control": "no-store" } },
    ),
  );
}

export function oauthError(
  status: number,
  error: string,
  description: string,
): Response {
  return applyCors(
    Response.json(
      { error, error_description: description },
      { status, headers: { "cache-control": "no-store" } },
    ),
  );
}
