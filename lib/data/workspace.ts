import "server-only";

import { io } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { dbError, SESSION_EXPIRED } from "@/lib/data/errors";
import {
  mapDocument,
  mapMaintenanceEvent,
  mapMaintenanceRequest,
  mapObligation,
  mapPayment,
  mapProperty,
  mapTenancy,
  mapTenant,
  mapUnit,
  mapVendor,
  type DocumentRow,
  type MaintenanceEventRow,
  type MaintenanceRequestRow,
  type ObligationRow,
  type PaymentRow,
  type ProfileRow,
  type PropertyRow,
  type TenancyRow,
  type TenantRow,
  type UnitRow,
  type VendorRow,
} from "@/lib/data/mappers";
import type { PortfolioSnapshot } from "@/lib/data/snapshot";
import { syncRentObligations } from "@/lib/data/obligations";
import { APP_TIME_ZONE, toCalendarDate } from "@/lib/dates";
import { APP_CURRENCY } from "@/lib/format";
import type { AppSettings } from "@/lib/settings";
import { currentActor } from "@/lib/data/actor";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRecord } from "@/types/document";
import type { MaintenanceEvent, MaintenanceRequest, Vendor } from "@/types/maintenance";
import type { Payment } from "@/types/payment";
import type { Property, RentalUnit } from "@/types/property";
import type { RentObligation } from "@/types/rent-obligation";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";

export type { PortfolioSnapshot } from "@/lib/data/snapshot";

export type Workspace = {
  revision: string;
  email: string;
  settings: AppSettings;
  portfolio: PortfolioSnapshot;
  documents: DocumentRecord[];
  requests: MaintenanceRequest[];
  vendors: Vendor[];
  events: MaintenanceEvent[];
};

type Session =
  | { ok: true; supabase: SupabaseClient; userId: string; email: string }
  | { ok: false; error: string };

export async function requireSession(): Promise<Session> {
  const actor = currentActor();
  if (actor) {
    return { ok: true, supabase: actor.supabase, userId: actor.userId, email: actor.email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: SESSION_EXPIRED };
  return {
    ok: true,
    supabase,
    userId: data.user.id,
    email: data.user.email ?? "",
  };
}

function mapSettings(profile: ProfileRow, email: string): AppSettings {
  return {
    profile: {
      fullName: profile.full_name,
      email,
      phone: profile.phone ?? "",
      accountType: "Landlord",
    },
    portfolio: {
      portfolioName: profile.portfolio_name,
      currency: APP_CURRENCY,
      dateFormat: profile.date_format,
      timeZone: APP_TIME_ZONE,
    },
    application: {
      timestampDisplay: profile.timestamp_display,
      notifications: {
        rentOverdue: profile.notify_rent_overdue,
        agreementEnding: profile.notify_agreement_ending,
        maintenanceUpdates: profile.notify_maintenance_updates,
        weeklySummary: profile.notify_weekly_summary,
      },
      dashboardView: profile.dashboard_view,
    },
  };
}

async function readTable<T>(
  query: PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }>,
): Promise<{ ok: true; rows: T[] } | { ok: false; error: string }> {
  const { data, error } = await query;
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, rows: (data ?? []) as T[] };
}

export async function loadWorkspace(): Promise<{ ok: true; value: Workspace } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { supabase, userId, email } = session;
  await io();
  const asOf = new Date().toISOString();
  const today = toCalendarDate(asOf);

  const [
    profileResult,
    properties,
    units,
    tenants,
    tenancies,
    payments,
    documents,
    vendors,
    requests,
    events,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    readTable<PropertyRow>(supabase.from("properties").select("*").order("created_at").order("id")),
    readTable<UnitRow>(supabase.from("rental_units").select("*").order("created_at").order("id")),
    readTable<TenantRow>(supabase.from("tenants").select("*").order("created_at").order("id")),
    readTable<TenancyRow>(supabase.from("tenancies").select("*").order("created_at").order("id")),
    readTable<PaymentRow>(supabase.from("payments").select("*").order("created_at").order("id")),
    readTable<DocumentRow>(supabase.from("documents").select("*").order("uploaded_at", { ascending: false })),
    readTable<VendorRow>(supabase.from("vendors").select("*").order("name")),
    readTable<MaintenanceRequestRow>(
      supabase.from("maintenance_requests").select("*").order("created_at", { ascending: false }),
    ),
    readTable<MaintenanceEventRow>(
      supabase.from("maintenance_events").select("*").order("occurred_at").order("id"),
    ),
  ]);

  if (profileResult.error) return { ok: false, error: dbError(profileResult.error) };
  if (!profileResult.data) {
    return { ok: false, error: "Your account profile is missing. Sign out and register again." };
  }
  for (const result of [properties, units, tenants, tenancies, payments, documents, vendors, requests, events]) {
    if (!result.ok) return result;
  }
  if (
    !properties.ok ||
    !units.ok ||
    !tenants.ok ||
    !tenancies.ok ||
    !payments.ok ||
    !documents.ok ||
    !vendors.ok ||
    !requests.ok ||
    !events.ok
  ) {
    return { ok: false, error: "The portfolio couldn't be loaded. Try again." };
  }

  const mappedTenancies = tenancies.rows.map(mapTenancy);
  const obligations = await syncRentObligations(supabase, userId, mappedTenancies, today);
  if (!obligations.ok) return obligations;

  const settings = mapSettings(profileResult.data as ProfileRow, email);
  const portfolio: PortfolioSnapshot = {
    asOf,
    today,
    properties: properties.rows.map(mapProperty),
    units: units.rows.map(mapUnit),
    tenants: tenants.rows.map(mapTenant),
    tenancies: mappedTenancies,
    payments: payments.rows.map(mapPayment),
    obligations: obligations.value,
  };

  const workspace: Workspace = {
    revision: revisionOf(profileResult.data as ProfileRow, portfolio, {
      documents: documents.rows,
      vendors: vendors.rows,
      requests: requests.rows,
      events: events.rows,
    }),
    email,
    settings,
    portfolio,
    documents: documents.rows.map(mapDocument),
    requests: requests.rows.map(mapMaintenanceRequest),
    vendors: vendors.rows.map(mapVendor),
    events: events.rows.map(mapMaintenanceEvent),
  };
  return { ok: true, value: workspace };
}

function revisionOf(
  profile: ProfileRow,
  portfolio: PortfolioSnapshot,
  rest: {
    documents: DocumentRow[];
    vendors: VendorRow[];
    requests: MaintenanceRequestRow[];
    events: MaintenanceEventRow[];
  },
): string {
  return JSON.stringify({
    profile: profile.updated_at,
    settings: [
      profile.full_name,
      profile.phone,
      profile.portfolio_name,
      profile.date_format,
      profile.timestamp_display,
      profile.dashboard_view,
      profile.notify_rent_overdue,
      profile.notify_agreement_ending,
      profile.notify_maintenance_updates,
      profile.notify_weekly_summary,
    ],
    properties: portfolio.properties.map((item) => item.id + item.name),
    units: portfolio.units.map((item) => `${item.id}:${item.status}:${item.monthlyRent}:${item.unitNumber}`),
    tenants: portfolio.tenants.map((item) => `${item.id}:${item.phone}:${item.email}:${item.fullName}`),
    tenancies: portfolio.tenancies.map(
      (item) => `${item.id}:${item.status}:${item.unitId}:${item.monthlyRent}:${item.moveOutDate ?? ""}`,
    ),
    payments: portfolio.payments.map((item) => item.id),
    obligations: portfolio.obligations.map((item) => `${item.id}:${item.expectedAmount}:${item.dueDate}`),
    documents: rest.documents.map((item) => `${item.id}:${item.storage_path}:${item.uploaded_at}`),
    vendors: rest.vendors.map((item) => item.id + item.name),
    requests: rest.requests.map(
      (item) => `${item.id}:${item.status}:${item.updated_at}:${item.priority}:${item.assigned_vendor_id ?? ""}`,
    ),
    events: rest.events.map((item) => item.id),
  });
}

export async function readPortfolioSlice(supabase: SupabaseClient): Promise<
  | {
      ok: true;
      properties: Property[];
      units: RentalUnit[];
      tenants: Tenant[];
      tenancies: Tenancy[];
      payments: Payment[];
      obligations: RentObligation[];
    }
  | { ok: false; error: string }
> {
  const [properties, units, tenants, tenancies, payments, obligations] = await Promise.all([
    readTable<PropertyRow>(supabase.from("properties").select("*")),
    readTable<UnitRow>(supabase.from("rental_units").select("*")),
    readTable<TenantRow>(supabase.from("tenants").select("*")),
    readTable<TenancyRow>(supabase.from("tenancies").select("*")),
    readTable<PaymentRow>(supabase.from("payments").select("*").order("created_at").order("id")),
    readTable<ObligationRow>(supabase.from("rent_obligations").select("*")),
  ]);
  if (!properties.ok) return properties;
  if (!units.ok) return units;
  if (!tenants.ok) return tenants;
  if (!tenancies.ok) return tenancies;
  if (!payments.ok) return payments;
  if (!obligations.ok) return obligations;
  return {
    ok: true,
    properties: properties.rows.map(mapProperty),
    units: units.rows.map(mapUnit),
    tenants: tenants.rows.map(mapTenant),
    tenancies: tenancies.rows.map(mapTenancy),
    payments: payments.rows.map(mapPayment),
    obligations: obligations.rows.map(mapObligation),
  };
}
