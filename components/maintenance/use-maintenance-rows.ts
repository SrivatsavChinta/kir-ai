"use client";

import { useMemo } from "react";

import { useMaintenance } from "@/components/maintenance/maintenance-provider";
import { usePortfolio } from "@/components/portfolio-provider";
import { compareByReported, resolveMaintenanceRow, type MaintenanceRow } from "@/lib/maintenance";

/** Every request joined with its property, unit, tenant and vendor, most recently reported first. */
export function useMaintenanceRows(): MaintenanceRow[] {
  const { properties, units, tenants, tenancies } = usePortfolio();
  const { requests, vendors } = useMaintenance();
  return useMemo(() => {
    const records = { properties, units, tenants, tenancies, vendors };
    return [...requests]
      .sort(compareByReported)
      .map((request) => resolveMaintenanceRow(request, records));
  }, [requests, vendors, properties, units, tenants, tenancies]);
}
