import type { Metadata } from "next";

import { TenantList } from "@/components/tenants/tenant-list";

export const metadata: Metadata = { title: "Tenants" };

export default function TenantsPage() {
  return <TenantList />;
}
