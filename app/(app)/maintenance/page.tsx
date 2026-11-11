import type { Metadata } from "next";

import { MaintenanceRequests } from "@/components/maintenance/maintenance-requests";

export const metadata: Metadata = { title: "Maintenance" };

export default function MaintenancePage() {
  return <MaintenanceRequests />;
}
