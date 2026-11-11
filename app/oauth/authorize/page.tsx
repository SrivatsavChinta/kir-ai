import type { Metadata } from "next";
import { io } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthorizeForm } from "@/components/auth/authorize-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/redirect";
import { redirectProblem, resolveClient } from "@/lib/mcp/oauth/clients";
import { normalizeScope } from "@/lib/mcp/oauth/flow";
import { createSupabaseOAuthStore } from "@/lib/mcp/oauth/supabase-store";
import { canonicalResource, mcpResourceUrl } from "@/lib/mcp/urls";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connect Claude" };

export default function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <p className="text-sm text-muted-foreground">Checking this connection…</p>
        </main>
      }
    >
      <AuthorizeDecision searchParams={searchParams} />
    </Suspense>
  );
}

async function AuthorizeDecision({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The Supabase session check reads the current time. Defer it to the request.
  await io();
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const next = safeNextPath(`/oauth/authorize?${query.toString()}`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);

  const clientId = query.get("client_id") ?? "";
  const redirectUri = query.get("redirect_uri") ?? "";
  const challenge = query.get("code_challenge") ?? "";
  const method = query.get("code_challenge_method") ?? "";
  const resource = query.get("resource") ?? "";
  let problem = "";
  let label = "An application";
  let redirectHost = "";

  if (query.get("response_type") !== "code") problem = "kir.ai only supports the authorization code flow.";
  else if (method !== "S256" || challenge.length < 43) problem = "This sign-in request is missing PKCE.";
  else {
    const scope = normalizeScope(query.get("scope"));
    if (typeof scope !== "string") problem = scope.description;
  }

  if (!problem) {
    try {
      const client = await resolveClient(createSupabaseOAuthStore(), clientId);
      if ("error" in client) problem = client.error;
      else {
        const redirectError = redirectProblem(client, redirectUri);
        if (redirectError) problem = redirectError;
        else {
          label = client.label;
          redirectHost = new URL(redirectUri).host;
        }
      }
    } catch (error) {
      console.error("OAuth authorize failed", error);
      problem = "kir.ai couldn't check this application. Apply the OAuth database migration and try again.";
    }
  }

  if (!problem && resource) {
    const origin = await pageOrigin();
    if (canonicalResource(resource) !== canonicalResource(mcpResourceUrl(origin))) {
      problem = "This request is for a different kir.ai address than this site.";
    }
  }

  const fields = {
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: method,
    state: query.get("state") ?? "",
    scope: query.get("scope") ?? "portfolio",
    resource,
  };

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect Claude to kir.ai</CardTitle>
          <CardDescription>
            {problem
              ? problem
              : `${label} is asking to read and update your kir.ai portfolio. You will be sent back to ${redirectHost}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {problem ? (
            <p>Nothing was connected. Close this window and try adding the connector again.</p>
          ) : (
            <>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Properties, units, tenants and tenancies</li>
                <li>Rent bills and payments</li>
                <li>Maintenance requests</li>
                <li>Document names and short-lived download links</li>
              </ul>
              <p className="text-muted-foreground">
                Signed in as {data.user.email}. Claude cannot see another landlord&apos;s records. You can disconnect
                this later in Settings.
              </p>
              <AuthorizeForm fields={fields} />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
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
