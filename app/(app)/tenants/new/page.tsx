import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { NewTenantForm } from "@/components/tenants/tenant-form";

export const metadata: Metadata = { title: "Add tenant" };

export default function NewTenantPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add tenant"
        description="Record the tenant's details and assign them to a vacant unit."
        back={{ href: "/tenants", label: "Tenants" }}
      />
      <NewTenantForm />
    </div>
  );
}
