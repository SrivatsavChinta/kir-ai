import type { DashboardRecords } from "@/types/dashboard";

// Fictional operational records for the sample portfolio in ./properties.ts.
// Rent payments are in ./payments.ts and maintenance requests in
// ./maintenance.ts. Every dashboard figure is derived in lib/dashboard.ts.
export const sampleDashboardRecords: DashboardRecords = {
  asOf: "2026-11-11T18:30:00+05:30",

  activity: [
    {
      id: "act-1",
      type: "payment_received",
      title: "Rent payment received",
      unitId: "unit-302",
      tenantId: "tenant-meera-joshi",
      amount: 40000,
      occurredAt: "2026-11-11T10:15:00+05:30",
    },
    {
      id: "act-2",
      type: "maintenance_created",
      title: "Maintenance request: Geyser not heating",
      unitId: "unit-villa2",
      tenantId: "tenant-rahul-verma",
      occurredAt: "2026-11-11T08:40:00+05:30",
    },
    {
      id: "act-3",
      type: "maintenance_created",
      title: "Maintenance request: Water leakage in bathroom",
      unitId: "unit-b101",
      tenantId: "tenant-rohan-das",
      occurredAt: "2026-11-10T19:20:00+05:30",
    },
    {
      id: "act-4",
      type: "payment_received",
      title: "Rent payment received",
      unitId: "unit-villa2",
      tenantId: "tenant-rahul-verma",
      amount: 65000,
      occurredAt: "2026-11-09T16:05:00+05:30",
    },
    {
      id: "act-5",
      type: "document_uploaded",
      title: "Rental agreement uploaded",
      unitId: "unit-villa5",
      tenantId: "tenant-aditi-menon",
      occurredAt: "2026-11-08T11:30:00+05:30",
    },
    {
      id: "act-6",
      type: "tenant_added",
      title: "New tenant added",
      unitId: "unit-villa5",
      tenantId: "tenant-aditi-menon",
      occurredAt: "2026-11-08T11:00:00+05:30",
    },
  ],
};
