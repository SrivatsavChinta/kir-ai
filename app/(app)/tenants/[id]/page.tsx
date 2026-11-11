import { Suspense } from "react";
import type { Metadata } from "next";

import { TenantDetail } from "@/components/tenants/tenant-detail";
import { sampleTenants } from "@/lib/mock-data/tenants";

export const metadata: Metadata = { title: "Tenant profile" };

export async function generateStaticParams() {
  return sampleTenants.map((tenant) => ({ id: tenant.id }));
}

// Tenants added during the session have ids unknown at build time, so the
// param is read inside Suspense to keep the rest of the route prerenderable.
export default function TenantPage({ params }: PageProps<"/tenants/[id]">) {
  return (
    <Suspense fallback={<TenantPageFallback />}>
      <TenantDetailForParams params={params} />
    </Suspense>
  );
}

async function TenantDetailForParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TenantDetail tenantId={id} />;
}

function TenantPageFallback() {
  return <div className="h-64 animate-pulse rounded-xl bg-muted/60" aria-busy />;
}
