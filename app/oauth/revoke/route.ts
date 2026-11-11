import { preflight } from "@/lib/mcp/http";
import { revokeToken } from "@/lib/mcp/oauth/flow";
import { createSupabaseOAuthStore } from "@/lib/mcp/oauth/supabase-store";

/** RFC 7009. Unknown tokens still get 200 so callers can't probe which tokens exist. */
export async function POST(request: Request) {
  try {
    const params = new URLSearchParams(await request.text());
    await revokeToken(createSupabaseOAuthStore(), params);
  } catch (error) {
    console.error("OAuth revocation failed", error);
  }
  return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
}

export function OPTIONS() {
  return preflight();
}
