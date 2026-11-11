import { Suspense } from "react";
import type { Metadata } from "next";

import { MaintenanceDetail } from "@/components/maintenance/maintenance-detail";
import { sampleMaintenanceRequests } from "@/lib/mock-data/maintenance";

export const metadata: Metadata = { title: "Maintenance request" };

export async function generateStaticParams() {
  return sampleMaintenanceRequests.map((request) => ({ id: request.id }));
}

// Requests created during the session have ids unknown at build time, so the
// param is read inside Suspense to keep the rest of the route prerenderable.
export default function MaintenanceRequestPage({ params }: PageProps<"/maintenance/[id]">) {
  return (
    <Suspense fallback={<MaintenanceRequestFallback />}>
      <MaintenanceDetailForParams params={params} />
    </Suspense>
  );
}

async function MaintenanceDetailForParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MaintenanceDetail requestId={id} />;
}

function MaintenanceRequestFallback() {
  return <div className="h-64 animate-pulse rounded-xl bg-muted/60" aria-busy />;
}
