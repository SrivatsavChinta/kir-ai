"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { MutationResult } from "@/components/portfolio-provider";
import {
  addMaintenanceNote,
  assignMaintenanceVendor,
  createMaintenanceRequest,
  saveMaintenancePriority,
  saveMaintenanceRequest,
  saveMaintenanceStatus,
} from "@/lib/data/actions/maintenance";
import type {
  MaintenanceEvent,
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceRequestInput,
  MaintenanceStatus,
  Vendor,
  VendorChoice,
} from "@/types/maintenance";

type MaintenanceContextValue = {
  requests: MaintenanceRequest[];
  vendors: Vendor[];
  events: MaintenanceEvent[];
  createRequest: (
    input: MaintenanceRequestInput,
    vendor: VendorChoice,
  ) => Promise<MutationResult<MaintenanceRequest>>;
  updateRequest: (
    id: string,
    input: MaintenanceRequestInput,
    vendor: VendorChoice,
  ) => Promise<MutationResult<MaintenanceRequest>>;
  changePriority: (id: string, priority: MaintenancePriority) => Promise<MutationResult<MaintenanceRequest>>;
  changeStatus: (
    id: string,
    status: MaintenanceStatus,
    note?: string,
  ) => Promise<MutationResult<MaintenanceRequest>>;
  assignVendor: (id: string, vendor: VendorChoice) => Promise<MutationResult<MaintenanceRequest>>;
  addNote: (id: string, note: string) => Promise<MutationResult<MaintenanceEvent>>;
};

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

type Snapshot = {
  requests: MaintenanceRequest[];
  vendors: Vendor[];
  events: MaintenanceEvent[];
};

export function MaintenanceProvider({
  revision,
  initialRequests,
  initialVendors,
  initialEvents,
  children,
}: {
  revision: string;
  initialRequests: MaintenanceRequest[];
  initialVendors: Vendor[];
  initialEvents: MaintenanceEvent[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const initial = { requests: initialRequests, vendors: initialVendors, events: initialEvents };
  const [state, setState] = useState({ revision, snapshot: initial });
  if (state.revision !== revision) setState({ revision, snapshot: initial });
  const snapshot = state.revision === revision ? state.snapshot : initial;

  const value = useMemo<MaintenanceContextValue>(() => {
    function adopt(update: (current: Snapshot) => Snapshot) {
      setState((current) => ({ revision: current.revision, snapshot: update(current.snapshot) }));
      router.refresh();
    }

    function store(
      request: MaintenanceRequest,
      events: MaintenanceEvent[],
      vendor?: Vendor,
    ) {
      adopt((current) => ({
        requests: current.requests.some((item) => item.id === request.id)
          ? current.requests.map((item) => (item.id === request.id ? request : item))
          : [request, ...current.requests],
        vendors: vendor
          ? current.vendors.some((item) => item.id === vendor.id)
            ? current.vendors
            : [...current.vendors, vendor]
          : current.vendors,
        events:
          events.length > 0
            ? [...current.events.filter((event) => event.requestId !== request.id), ...events]
            : current.events,
      }));
    }

    return {
      ...snapshot,
      async createRequest(input, vendor) {
        const result = await createMaintenanceRequest(input, vendor);
        if (!result.ok) return result;
        store(result.value.request, result.value.events, result.value.vendor);
        return { ok: true, value: result.value.request };
      },
      async updateRequest(id, input, vendor) {
        const result = await saveMaintenanceRequest(id, input, vendor);
        if (!result.ok) return result;
        store(result.value.request, result.value.events, result.value.vendor);
        return { ok: true, value: result.value.request };
      },
      async changePriority(id, priority) {
        const result = await saveMaintenancePriority(id, priority);
        if (!result.ok) return result;
        store(result.value.request, result.value.events);
        return { ok: true, value: result.value.request };
      },
      async changeStatus(id, status, note) {
        const result = await saveMaintenanceStatus(id, status, note);
        if (!result.ok) return result;
        store(result.value.request, result.value.events);
        return { ok: true, value: result.value.request };
      },
      async assignVendor(id, vendor) {
        const result = await assignMaintenanceVendor(id, vendor);
        if (!result.ok) return result;
        store(result.value.request, result.value.events, result.value.vendor);
        return { ok: true, value: result.value.request };
      },
      async addNote(id, note) {
        const result = await addMaintenanceNote(id, note);
        if (!result.ok) return result;
        adopt((current) => ({
          ...current,
          requests: current.requests.map((request) =>
            request.id === result.value.request.id ? result.value.request : request,
          ),
          events: [...current.events, result.value.event],
        }));
        return { ok: true, value: result.value.event };
      },
    };
  }, [snapshot, router]);

  return <MaintenanceContext value={value}>{children}</MaintenanceContext>;
}

export function useMaintenance(): MaintenanceContextValue {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error("useMaintenance must be used within a MaintenanceProvider.");
  }
  return context;
}
