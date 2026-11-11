import { Suspense } from "react";
import type { Metadata } from "next";

import { TenancyFormPage } from "@/components/tenants/tenancy-form";
import { sampleTenants } from "@/lib/mock-data/tenants";

export const metadata: Metadata = { title: "Tenancy" };

export async function generateStaticParams() {
  return sampleTenants.map((tenant) => ({ id: tenant.id }));
}

export default function TenancyPage({ params }: PageProps<"/tenants/[id]/tenancy">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/60" aria-busy />}>
      <TenancyForParams params={params} />
    </Suspense>
  );
}

async function TenancyForParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TenancyFormPage tenantId={id} />;
}
