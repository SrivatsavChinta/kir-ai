import { Suspense } from "react";
import type { Metadata } from "next";

import { EditPropertyForm } from "@/components/properties/property-form";
import { sampleProperties } from "@/lib/mock-data/properties";

export const metadata: Metadata = { title: "Edit property" };

export async function generateStaticParams() {
  return sampleProperties.map((property) => ({ id: property.id }));
}

export default function EditPropertyPage({ params }: PageProps<"/properties/[id]/edit">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/60" aria-busy />}>
      <EditPropertyFormForParams params={params} />
    </Suspense>
  );
}

async function EditPropertyFormForParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditPropertyForm propertyId={id} />;
}
