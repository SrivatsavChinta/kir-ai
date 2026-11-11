/** Origin Claude used to reach this deployment. */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto?.split(",")[0]?.trim() || url.protocol.replace(":", "");
    return `${proto}://${forwardedHost.split(",")[0]?.trim()}`;
  }
  return url.origin;
}

export function siteOrigin(request?: Request): string {
  if (request) return requestOrigin(request);
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function mcpResourceUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/mcp`;
}

export function protectedResourceMetadataUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/.well-known/oauth-protected-resource/api/mcp`;
}

export function canonicalResource(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return value;
  }
}
