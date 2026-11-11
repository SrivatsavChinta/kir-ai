"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAuthorizationCode, normalizeScope } from "@/lib/mcp/oauth/flow";
import { redirectProblem, resolveClient } from "@/lib/mcp/oauth/clients";
import { createSupabaseOAuthStore } from "@/lib/mcp/oauth/supabase-store";
import { canonicalResource, mcpResourceUrl } from "@/lib/mcp/urls";
import { createClient } from "@/lib/supabase/server";

export type AuthorizeState = { error?: string };

export async function decideAccess(_state: AuthorizeState, formData: FormData): Promise<AuthorizeState> {
  const decision = String(formData.get("decision") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const challenge = String(formData.get("code_challenge") ?? "");
  const method = String(formData.get("code_challenge_method") ?? "");
  const resource = String(formData.get("resource") ?? "");
  const scopeResult = normalizeScope(String(formData.get("scope") ?? ""));
  if (typeof scopeResult !== "string") return { error: scopeResult.description };

  let client: Awaited<ReturnType<typeof resolveClient>>;
  try {
    client = await resolveClient(createSupabaseOAuthStore(), clientId);
  } catch (error) {
    console.error("OAuth client lookup failed", error);
    return { error: "kir.ai couldn't check this application. Apply the OAuth migration and try again." };
  }
  if ("error" in client) return { error: client.error };
  const redirectError = redirectProblem(client, redirectUri);
  if (redirectError) return { error: redirectError };
  if (method !== "S256" || challenge.length < 43) {
    return { error: "The sign-in request is missing a PKCE challenge." };
  }
  if (resource && canonicalResource(resource) !== canonicalResource(mcpResourceUrl(await pageOrigin()))) {
    return { error: "This request is for a different kir.ai address than this site." };
  }

  const target = new URL(redirectUri);
  if (state) target.searchParams.set("state", state);
  if (decision !== "approve") {
    target.searchParams.set("error", "access_denied");
    target.searchParams.set("error_description", "The landlord denied access.");
    redirect(target.toString());
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const refreshToken = sessionData.session?.refresh_token;
  if (userError || !userData.user || !refreshToken || sessionData.session?.user.id !== userData.user.id) {
    return { error: "Sign out and sign in again, then approve Claude." };
  }

  let code: string;
  try {
    code = await createAuthorizationCode(createSupabaseOAuthStore(), {
      clientId,
      clientLabel: client.label,
      userId: userData.user.id,
      redirectUri,
      codeChallenge: challenge,
      scope: scopeResult,
      resource: resource || null,
      supabaseRefreshToken: refreshToken,
    });
  } catch (error) {
    console.error("OAuth approval failed", error);
    return { error: "kir.ai couldn't start the connection. Check MCP_TOKEN_ENCRYPTION_KEY and the OAuth migration." };
  }
  target.searchParams.set("code", code);
  redirect(target.toString());
}

async function pageOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host")?.split(",")[0]?.trim() || headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
