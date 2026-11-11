import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in to kir.ai</CardTitle>
        <CardDescription>Landlord email and password.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <div className="space-y-5">
      {!configured && (
        <p className="text-sm text-muted-foreground">
          Supabase isn&apos;t configured, so the portfolio cannot be loaded. Add the variables
          from <span className="font-medium">.env.example</span> to{" "}
          <span className="font-medium">.env.local</span>, then restart the dev server. Setup
          steps are in <span className="font-medium">docs/supabase-setup.md</span>.
        </p>
      )}
      <LoginForm nextPath={safeNextPath(params.next)} confirmFailed={params.error === "confirm"} />
    </div>
  );
}
