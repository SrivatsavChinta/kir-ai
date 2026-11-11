import { Suspense } from "react";
import type { Metadata } from "next";

import { PropertyDetail } from "@/components/properties/property-detail";
import { sampleProperties } from "@/lib/mock-data/properties";

export const metadata: Metadata = { title: "Property details" };

export async function generateStaticParams() {
  return sampleProperties.map((property) => ({ id: property.id }));
}

// Properties created during the session have ids unknown at build time, so the
// param is read inside Suspense to keep the rest of the route prerenderable.
export default function PropertyPage({ params }: PageProps<"/properties/[id]">) {
  return (
    <Suspense fallback={<PropertyPageFallback />}>
      <PropertyDetailForParams params={params} />
    </Suspense>
  );
}

async function PropertyDetailForParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PropertyDetail propertyId={id} />;
}

function PropertyPageFallback() {
  return <div className="h-64 animate-pulse rounded-xl bg-muted/60" aria-busy />;
}
