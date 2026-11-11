import { isAllowedRedirect, redirectMatches } from "@/lib/mcp/pkce";
import type { OAuthStore } from "@/lib/mcp/oauth/types";

export type ResolvedClient = {
  id: string;
  /** Shown on the consent screen. For a metadata document this is the host, not the self-asserted name. */
  label: string;
  redirectUris: string[];
};

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|.*\.local|.*\.internal)$/i;

export async function resolveClient(store: OAuthStore, clientId: string): Promise<ResolvedClient | { error: string }> {
  if (!clientId || clientId.length > 500) return { error: "That client id is not valid." };
  if (clientId.startsWith("https://")) return fetchClientMetadata(clientId);
  const stored = await store.getClient(clientId);
  if (!stored) return { error: "This application is not registered with kir.ai." };
  return { id: stored.id, label: stored.name, redirectUris: stored.redirectUris };
}

/**
 * Null when the redirect may be used. The two failures stay separate: a URL
 * outside the allowlist is refused even if a client lists it, and an
 * allowlisted URL is refused when this client did not register it.
 */
export function redirectProblem(client: ResolvedClient, redirectUri: string): string | null {
  if (!isAllowedRedirect(redirectUri)) {
    return "This application wants to send you to a redirect URL kir.ai does not allow.";
  }
  if (!client.redirectUris.some((registered) => redirectMatches(registered, redirectUri))) {
    return "This application did not register that callback with kir.ai.";
  }
  return null;
}

export function acceptedRedirect(client: ResolvedClient, redirectUri: string): boolean {
  return redirectProblem(client, redirectUri) === null;
}

async function fetchClientMetadata(clientId: string): Promise<ResolvedClient | { error: string }> {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return { error: "That client id is not a valid URL." };
  }
  if (url.protocol !== "https:" || url.username || url.password || PRIVATE_HOST.test(url.hostname)) {
    return { error: "kir.ai only accepts an HTTPS client metadata document on a public host." };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
  } catch {
    return { error: "kir.ai couldn't read the client's metadata document." };
  }
  if (!response.ok) return { error: "The client's metadata document was not available." };
  const text = await response.text();
  if (text.length > 65_536) return { error: "The client's metadata document is too large." };

  let body: {
    client_id?: unknown;
    client_name?: unknown;
    redirect_uris?: unknown;
  };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return { error: "The client's metadata document is not JSON." };
  }
  if (body.client_id !== clientId) return { error: "The metadata document's client id does not match." };
  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.some((uri) => typeof uri !== "string")) {
    return { error: "The metadata document has no redirect URLs." };
  }
  const redirectUris = body.redirect_uris.filter((uri): uri is string => isAllowedRedirect(uri));
  if (redirectUris.length === 0) {
    return { error: "None of the client's redirect URLs are ones kir.ai can send you back to." };
  }
  return { id: clientId, label: url.host, redirectUris };
}
