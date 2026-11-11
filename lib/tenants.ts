import { daysBetween } from "@/lib/dates";
import { pluralize } from "@/lib/format";
import type { Property, RentalUnit } from "@/types/property";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant, TenantStatus } from "@/types/tenant";

/** Agreements ending within this many days are flagged for renewal. */
export const AGREEMENT_EXPIRY_WINDOW_DAYS = 60;

export function getActiveTenancyForUnit(
  tenancies: Tenancy[],
  unitId: string,
): Tenancy | undefined {
  return tenancies.find(
    (tenancy) => tenancy.unitId === unitId && tenancy.status === "Active",
  );
}

/** The tenant's active tenancy, if any. A tenant holds at most one at a time. */
export function getCurrentTenancy(
  tenancies: Tenancy[],
  tenantId: string,
): Tenancy | undefined {
  return tenancies.find(
    (tenancy) => tenancy.tenantId === tenantId && tenancy.status === "Active",
  );
}

/** All of a tenant's tenancies: the active one first, then the most recent. */
export function getTenancyHistory(tenancies: Tenancy[], tenantId: string): Tenancy[] {
  return tenancies
    .filter((tenancy) => tenancy.tenantId === tenantId)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "Active" ? -1 : 1;
      return b.moveInDate.localeCompare(a.moveInDate);
    });
}

/** The tenancy that best describes the tenant now: current, else most recent. */
export function getLatestTenancy(
  tenancies: Tenancy[],
  tenantId: string,
): Tenancy | undefined {
  return getTenancyHistory(tenancies, tenantId)[0];
}

export type AgreementState =
  | { kind: "current"; daysRemaining: number }
  | { kind: "ending-soon"; daysRemaining: number }
  | { kind: "expired"; daysRemaining: number };

/** Where an active tenancy's agreement stands relative to `today` (YYYY-MM-DD). */
export function getAgreementState(tenancy: Tenancy, today: string): AgreementState {
  const daysRemaining = daysBetween(today, tenancy.agreementEndDate);
  if (daysRemaining < 0) return { kind: "expired", daysRemaining };
  if (daysRemaining <= AGREEMENT_EXPIRY_WINDOW_DAYS) {
    return { kind: "ending-soon", daysRemaining };
  }
  return { kind: "current", daysRemaining };
}

export function describeAgreement(state: AgreementState): string {
  const days = Math.abs(state.daysRemaining);
  if (state.kind === "expired") return `Agreement expired ${pluralize(days, "day")} ago`;
  if (days === 0) return "Agreement ends today";
  return `Agreement ends in ${pluralize(days, "day")}`;
}

/** "1st of each month", "22nd of each month" and so on. */
export function formatDueDay(day: number): string {
  const lastTwo = day % 100;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  return `${day}${suffix} of each month`;
}

/** A tenant joined with their current (or most recent) tenancy and its unit. */
export type TenantRow = {
  tenant: Tenant;
  status: TenantStatus;
  tenancy?: Tenancy;
  unit?: RentalUnit;
  property?: Property;
  /** Set only while the tenancy is active. */
  agreement?: AgreementState;
};

export function getTenantRows(
  data: {
    tenants: Tenant[];
    tenancies: Tenancy[];
    units: RentalUnit[];
    properties: Property[];
  },
  today: string,
): TenantRow[] {
  const unitById = new Map(data.units.map((unit) => [unit.id, unit]));
  const propertyById = new Map(data.properties.map((property) => [property.id, property]));

  return data.tenants
    .map((tenant) => {
      const tenancy = getLatestTenancy(data.tenancies, tenant.id);
      const unit = tenancy ? unitById.get(tenancy.unitId) : undefined;
      const active = tenancy?.status === "Active";
      return {
        tenant,
        status: active ? "Active" : "Former",
        tenancy,
        unit,
        property: unit ? propertyById.get(unit.propertyId) : undefined,
        agreement: active ? getAgreementState(tenancy, today) : undefined,
      } satisfies TenantRow;
    })
    .sort((a, b) => a.tenant.fullName.localeCompare(b.tenant.fullName));
}

export function findTenant(tenants: Tenant[], tenantId: string): Tenant | undefined {
  return tenants.find((tenant) => tenant.id === tenantId);
}