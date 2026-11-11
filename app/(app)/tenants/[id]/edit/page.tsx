import { Suspense } from "react";
import type { Metadata } from "next";

import { EditTenantDetails } from "@/components/tenants/tenant-form";
import { sampleTenants } from "@/lib/mock-data/tenants";

export const metadata: Metadata = { title: "Edit tenant" };

export async function generateStaticParams() {
  return sampleTenants.map((tenant) => ({ id: tenant.id }));
}

export default function EditTenantPage({ params }: PageProps<"/tenants/[id]/edit">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/60" aria-busy />}>
      <EditTenantForParams params={params} />
    </Suspense>
  );
}

async function EditTenantForParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditTenantDetails tenantId={id} />;
}
