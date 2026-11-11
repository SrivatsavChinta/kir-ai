"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dbError } from "@/lib/data/errors";
import {
  mapMaintenanceEvent,
  mapMaintenanceRequest,
  mapVendor,
  type MaintenanceEventRow,
  type MaintenanceRequestRow,
  type VendorRow,
} from "@/lib/data/mappers";
import { requireSession, readPortfolioSlice } from "@/lib/data/workspace";
import { toCalendarDate } from "@/lib/dates";
import {
  checkMaintenanceInput,
  detailEvents,
  planStatusChange,
  priorityEvent,
  resolveVendorChoice,
  vendorChangeEvent,
  type PlannedEvent,
} from "@/lib/maintenance-changes";
import type { MutationResult } from "@/lib/mutation";
import type { Property, RentalUnit } from "@/types/property";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";
import type {
  MaintenanceEvent,
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceRequestInput,
  MaintenanceStatus,
  Vendor,
  VendorChoice,
  VendorInput,
} from "@/types/maintenance";

async function loadMaintenance(supabase: SupabaseClient): Promise<
  MutationResult<{
    requests: MaintenanceRequest[];
    vendors: Vendor[];
    properties: Property[];
    units: RentalUnit[];
    tenants: Tenant[];
    tenancies: Tenancy[];
  }>
> {
  const portfolio = await readPortfolioSlice(supabase);
  if (!portfolio.ok) return portfolio;
  const [requests, vendors] = await Promise.all([
    supabase.from("maintenance_requests").select("*"),
    supabase.from("vendors").select("*"),
  ]);
  if (requests.error) return { ok: false, error: dbError(requests.error) };
  if (vendors.error) return { ok: false, error: dbError(vendors.error) };
  return {
    ok: true,
    value: {
      requests: ((requests.data ?? []) as MaintenanceRequestRow[]).map(mapMaintenanceRequest),
      vendors: ((vendors.data ?? []) as VendorRow[]).map(mapVendor),
      properties: portfolio.properties,
      units: portfolio.units,
      tenants: portfolio.tenants,
      tenancies: portfolio.tenancies,
    },
  };
}

function recordsOf(bundle: {
  properties: { id: string; name: string; propertyType: "Apartment Building" | "Independent House" | "Villa"; address: string; city: string; state: string; pincode: string; description: string }[];
  units: { id: string; propertyId: string; unitNumber: string; monthlyRent: number; status: "Occupied" | "Vacant" }[];
  tenants: { id: string; fullName: string; phone: string; email: string }[];
  tenancies: {
    id: string;
    tenantId: string;
    unitId: string;
    status: "Active" | "Ended";
    moveInDate: string;
    moveOutDate?: string;
    monthlyRent: number;
    securityDeposit: number;
    rentDueDay: number;
    agreementStartDate: string;
    agreementEndDate: string;
  }[];
}) {
  return bundle;
}

function eventsPayload(events: PlannedEvent[]) {
  return events.map((event) => ({ event_type: event.eventType, description: event.description }));
}

async function insertVendor(
  supabase: SupabaseClient,
  landlordId: string,
  input: VendorInput,
): Promise<MutationResult<Vendor>> {
  const { data, error } = await supabase
    .from("vendors")
    .insert({
      landlord_id: landlordId,
      name: input.name,
      service_category: input.serviceCategory,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, value: mapVendor(data as VendorRow) };
}

async function eventsFor(supabase: SupabaseClient, requestId: string): Promise<MutationResult<MaintenanceEvent[]>> {
  const { data, error } = await supabase
    .from("maintenance_events")
    .select("*")
    .eq("request_id", requestId)
    .order("occurred_at")
    .order("id");
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, value: ((data ?? []) as MaintenanceEventRow[]).map(mapMaintenanceEvent) };
}

export async function createMaintenanceRequest(
  input: MaintenanceRequestInput,
  vendorChoice: VendorChoice,
): Promise<MutationResult<{ request: MaintenanceRequest; events: MaintenanceEvent[]; vendor?: Vendor }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const loaded = await loadMaintenance(session.supabase);
  if (!loaded.ok) return loaded;
  const today = toCalendarDate(new Date().toISOString());
  const checked = checkMaintenanceInput(input, today, recordsOf(loaded.value));
  if (!checked.ok) return checked;
  const vendor = resolveVendorChoice(vendorChoice, loaded.value.vendors);
  if (!vendor.ok) return vendor;

  let createdVendor: Vendor | undefined;
  if (vendor.value.create) {
    const inserted = await insertVendor(session.supabase, session.userId, vendor.value.create);
    if (!inserted.ok) return inserted;
    createdVendor = inserted.value;
  }
  const assigned = createdVendor ?? vendor.value.vendor;
  const events: PlannedEvent[] = [{ eventType: "created", description: "Request created" }];
  const assignedEvent = vendorChangeEvent(undefined, assigned, Boolean(createdVendor));
  if (assignedEvent) events.push(assignedEvent);

  const { data, error } = await session.supabase.rpc("insert_maintenance_request", {
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_priority: input.priority,
    p_property_id: input.propertyId,
    p_unit_id: input.unitId || null,
    p_tenant_id: input.tenantId || null,
    p_tenancy_id: checked.value ?? null,
    p_reported_at: input.reportedAt,
    p_target_resolution_date: input.targetResolutionDate || null,
    p_assigned_vendor_id: assigned?.id ?? null,
    p_events: eventsPayload(events),
  });
  if (error) {
    if (createdVendor) await session.supabase.from("vendors").delete().eq("id", createdVendor.id);
    return { ok: false, error: dbError(error) };
  }
  const request = mapMaintenanceRequest(data as MaintenanceRequestRow);
  const history = await eventsFor(session.supabase, request.id);
  if (!history.ok) return { ok: true, value: { request, events: [], vendor: createdVendor } };
  return { ok: true, value: { request, events: history.value, vendor: createdVendor } };
}

export async function saveMaintenanceRequest(
  id: string,
  input: MaintenanceRequestInput,
  vendorChoice: VendorChoice,
): Promise<MutationResult<{ request: MaintenanceRequest; events: MaintenanceEvent[]; vendor?: Vendor }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const loaded = await loadMaintenance(session.supabase);
  if (!loaded.ok) return loaded;
  const existing = loaded.value.requests.find((request) => request.id === id);
  if (!existing) return { ok: false, error: "This maintenance request no longer exists." };
  if (existing.status === "Closed") {
    return { ok: false, error: "Closed requests can't be edited. Add a note instead." };
  }
  const today = toCalendarDate(new Date().toISOString());
  const checked = checkMaintenanceInput(input, today, recordsOf(loaded.value), existing);
  if (!checked.ok) return checked;
  const vendor = resolveVendorChoice(vendorChoice, loaded.value.vendors);
  if (!vendor.ok) return vendor;

  let createdVendor: Vendor | undefined;
  if (vendor.value.create) {
    const inserted = await insertVendor(session.supabase, session.userId, vendor.value.create);
    if (!inserted.ok) return inserted;
    createdVendor = inserted.value;
  }
  const assigned = createdVendor ?? vendor.value.vendor;
  const previousVendor = loaded.value.vendors.find((item) => item.id === existing.assignedVendorId);
  const events = detailEvents(existing, input, previousVendor, assigned, Boolean(createdVendor));
  if (events.length === 0) return { ok: true, value: { request: existing, events: [] } };

  const { data, error } = await session.supabase.rpc("update_maintenance_request", {
    p_request_id: id,
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_priority: input.priority,
    p_property_id: input.propertyId,
    p_unit_id: input.unitId || null,
    p_tenant_id: input.tenantId || null,
    p_tenancy_id: checked.value ?? null,
    p_reported_at: input.reportedAt,
    p_target_resolution_date: input.targetResolutionDate || null,
    p_assigned_vendor_id: assigned?.id ?? null,
    p_events: eventsPayload(events),
  });
  if (error) {
    if (createdVendor) await session.supabase.from("vendors").delete().eq("id", createdVendor.id);
    return { ok: false, error: dbError(error) };
  }
  const request = mapMaintenanceRequest(data as MaintenanceRequestRow);
  const history = await eventsFor(session.supabase, request.id);
  return { ok: true, value: { request, events: history.ok ? history.value : [], vendor: createdVendor } };
}

export async function saveMaintenancePriority(
  id: string,
  priority: MaintenancePriority,
): Promise<MutationResult<{ request: MaintenanceRequest; events: MaintenanceEvent[] }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const loaded = await loadMaintenance(session.supabase);
  if (!loaded.ok) return loaded;
  const existing = loaded.value.requests.find((request) => request.id === id);
  if (!existing) return { ok: false, error: "This maintenance request no longer exists." };
  const planned = priorityEvent(existing, priority);
  if (!planned.ok) return planned;
  if (!planned.value) return { ok: true, value: { request: existing, events: [] } };

  const { data, error } = await session.supabase.rpc("update_maintenance_request", {
    p_request_id: id,
    p_title: existing.title,
    p_description: existing.description,
    p_category: existing.category,
    p_priority: priority,
    p_property_id: existing.propertyId,
    p_unit_id: existing.unitId ?? null,
    p_tenant_id: existing.tenantId ?? null,
    p_tenancy_id: existing.tenancyId ?? null,
    p_reported_at: existing.reportedAt,
    p_target_resolution_date: existing.targetResolutionDate ?? null,
    p_assigned_vendor_id: existing.assignedVendorId ?? null,
    p_events: eventsPayload([planned.value]),
  });
  if (error) return { ok: false, error: dbError(error) };
  const request = mapMaintenanceRequest(data as MaintenanceRequestRow);
  const history = await eventsFor(session.supabase, id);
  return { ok: true, value: { request, events: history.ok ? history.value : [] } };
}

export async function saveMaintenanceStatus(
  id: string,
  status: MaintenanceStatus,
  note?: string,
): Promise<MutationResult<{ request: MaintenanceRequest; events: MaintenanceEvent[] }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const loaded = await loadMaintenance(session.supabase);
  if (!loaded.ok) return loaded;
  const existing = loaded.value.requests.find((request) => request.id === id);
  if (!existing) return { ok: false, error: "This maintenance request no longer exists." };
  const planned = planStatusChange(existing, status, note);
  if (!planned.ok) return planned;

  const { data, error } = await session.supabase.rpc("change_maintenance_status", {
    p_request_id: id,
    p_status: status,
    p_events: eventsPayload(planned.value.events),
  });
  if (error) return { ok: false, error: dbError(error) };
  const request = mapMaintenanceRequest(data as MaintenanceRequestRow);
  const history = await eventsFor(session.supabase, id);
  return { ok: true, value: { request, events: history.ok ? history.value : [] } };
}

export async function assignMaintenanceVendor(
  id: string,
  vendorChoice: VendorChoice,
): Promise<MutationResult<{ request: MaintenanceRequest; events: MaintenanceEvent[]; vendor?: Vendor }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const loaded = await loadMaintenance(session.supabase);
  if (!loaded.ok) return loaded;
  const existing = loaded.value.requests.find((request) => request.id === id);
  if (!existing) return { ok: false, error: "This maintenance request no longer exists." };
  if (existing.status === "Closed") return { ok: false, error: "Closed requests can't be changed." };
  const vendor = resolveVendorChoice(vendorChoice, loaded.value.vendors);
  if (!vendor.ok) return vendor;

  let createdVendor: Vendor | undefined;
  if (vendor.value.create) {
    const inserted = await insertVendor(session.supabase, session.userId, vendor.value.create);
    if (!inserted.ok) return inserted;
    createdVendor = inserted.value;
  }
  const assigned = createdVendor ?? vendor.value.vendor;
  const previous = loaded.value.vendors.find((item) => item.id === existing.assignedVendorId);
  const change = vendorChangeEvent(previous, assigned, Boolean(createdVendor));
  if (!change) return { ok: true, value: { request: existing, events: [] } };

  const { data, error } = await session.supabase.rpc("update_maintenance_request", {
    p_request_id: id,
    p_title: existing.title,
    p_description: existing.description,
    p_category: existing.category,
    p_priority: existing.priority,
    p_property_id: existing.propertyId,
    p_unit_id: existing.unitId ?? null,
    p_tenant_id: existing.tenantId ?? null,
    p_tenancy_id: existing.tenancyId ?? null,
    p_reported_at: existing.reportedAt,
    p_target_resolution_date: existing.targetResolutionDate ?? null,
    p_assigned_vendor_id: assigned?.id ?? null,
    p_events: eventsPayload([change]),
  });
  if (error) {
    if (createdVendor) await session.supabase.from("vendors").delete().eq("id", createdVendor.id);
    return { ok: false, error: dbError(error) };
  }
  const request = mapMaintenanceRequest(data as MaintenanceRequestRow);
  const history = await eventsFor(session.supabase, id);
  return { ok: true, value: { request, events: history.ok ? history.value : [], vendor: createdVendor } };
}

export async function addMaintenanceNote(
  id: string,
  note: string,
): Promise<MutationResult<{ request: MaintenanceRequest; event: MaintenanceEvent }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { validateNote } = await import("@/lib/maintenance-validation");
  const checked = validateNote(note);
  if (!checked.success) return { ok: false, error: checked.error };

  const { data, error } = await session.supabase.rpc("add_maintenance_note", {
    p_request_id: id,
    p_description: checked.data,
  });
  if (error) return { ok: false, error: dbError(error) };

  const { data: requestRow, error: requestError } = await session.supabase
    .from("maintenance_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (requestError) return { ok: false, error: dbError(requestError) };
  if (!requestRow) return { ok: false, error: "This maintenance request no longer exists." };
  return {
    ok: true,
    value: {
      request: mapMaintenanceRequest(requestRow as MaintenanceRequestRow),
      event: mapMaintenanceEvent(data as MaintenanceEventRow),
    },
  };
}
