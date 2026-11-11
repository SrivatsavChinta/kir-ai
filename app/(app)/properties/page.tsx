import type { Metadata } from "next";

import { PropertyList } from "@/components/properties/property-list";

export const metadata: Metadata = { title: "Properties" };

export default function PropertiesPage() {
  return <PropertyList />;
}
