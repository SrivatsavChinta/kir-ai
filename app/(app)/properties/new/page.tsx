import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { PropertyForm } from "@/components/properties/property-form";

export const metadata: Metadata = { title: "Add property" };

export default function NewPropertyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add property"
        description="Add the building, house or villa first. You can add its rental units next."
        back={{ href: "/properties", label: "Properties" }}
      />
      <PropertyForm />
    </div>
  );
}
