import { Suspense } from "react";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { DocumentsProvider } from "@/components/documents/documents-provider";
import { AppShell } from "@/components/layout/app-shell";
import { MaintenanceProvider } from "@/components/maintenance/maintenance-provider";
import { PortfolioProvider } from "@/components/portfolio-provider";
import { SettingsProvider } from "@/components/settings/settings-provider";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<PortfolioLoading />}>
      <LandlordWorkspace>{children}</LandlordWorkspace>
    </Suspense>
  );
}

async function LandlordWorkspace({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <BlockingMessage
        title="Supabase isn't configured"
        message="Add the project URL and anon key in .env.local, then restart the app. The portfolio is not loaded from sample data."
      />
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const workspace = await loadWorkspace();
  if (!workspace.ok) {
    return (
      <BlockingMessage title="Couldn't load your portfolio" message={workspace.error}>
        <LogoutButton />
      </BlockingMessage>
    );
  }

  const { revision, settings, portfolio, documents, requests, vendors, events } = workspace.value;
  return (
    <SettingsProvider revision={revision} initialSettings={settings}>
      <PortfolioProvider revision={revision} initial={portfolio}>
        <DocumentsProvider revision={revision} initialDocuments={documents}>
          <MaintenanceProvider
            revision={revision}
            initialRequests={requests}
            initialVendors={vendors}
            initialEvents={events}
          >
            <AppShell showLogout>{children}</AppShell>
          </MaintenanceProvider>
        </DocumentsProvider>
      </PortfolioProvider>
    </SettingsProvider>
  );
}

function PortfolioLoading() {
  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 p-6" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
    </div>
  );
}

function BlockingMessage({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      {children}
    </main>
  );
}
