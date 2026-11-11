import { applyCors, oauthError, preflight } from "@/lib/mcp/http";
import { exchangeAuthorizationCode, refreshAccessToken } from "@/lib/mcp/oauth/flow";
import { createSupabaseOAuthStore } from "@/lib/mcp/oauth/supabase-store";
import { mcpResourceUrl, requestOrigin } from "@/lib/mcp/urls";

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/x-www-form-urlencoded") && !type.includes("application/json")) {
    return oauthError(415, "invalid_request", "Send the token request as application/x-www-form-urlencoded.");
  }
  const params = await readParams(request);
  const grant = params.get("grant_type");
  const resource = mcpResourceUrl(requestOrigin(request));
  try {
    const store = createSupabaseOAuthStore();
    const result =
      grant === "authorization_code"
        ? await exchangeAuthorizationCode(store, params, resource)
        : grant === "refresh_token"
          ? await refreshAccessToken(store, params, resource)
          : { ok: false as const, status: 400, error: "unsupported_grant_type", description: "Use authorization_code or refresh_token." };
    if (!result.ok) return oauthError(result.status, result.error, result.description);
    return applyCors(
      Response.json(
        {
          access_token: result.access_token,
          token_type: result.token_type,
          expires_in: result.expires_in,
          refresh_token: result.refresh_token,
          scope: result.scope,
        },
        { status: 200, headers: { "cache-control": "no-store" } },
      ),
    );
  } catch (error) {
    console.error("OAuth token request failed", error);
    return oauthError(500, "server_error", "kir.ai couldn't issue a token.");
  }
}

async function readParams(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") params.set(key, value);
    }
    return params;
  }
  return new URLSearchParams(await request.text());
}

export function OPTIONS() {
  return preflight();
}
