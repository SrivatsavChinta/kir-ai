import { daysBetween } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceStatus,
  Vendor,
} from "@/types/maintenance";
import type { Property, RentalUnit } from "@/types/property";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";

export const MAINTENANCE_CATEGORIES: readonly MaintenanceCategory[] = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Painting",
  "Appliance",
  "Structural",
  "Pest Control",
  "Cleaning",
  "Other",
];

export const MAINTENANCE_PRIORITIES: readonly MaintenancePriority[] = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

export const MAINTENANCE_STATUSES: readonly MaintenanceStatus[] = [
  "Open",
  "In Progress",
  "On Hold",
  "Resolved",
  "Closed",
];

/** Statuses of requests that still need work. */
export const UNRESOLVED_STATUSES: readonly MaintenanceStatus[] = ["Open", "In Progress", "On Hold"];

/** Priorities counted as high priority in summaries and alerts. */
export const HIGH_PRIORITIES: readonly MaintenancePriority[] = ["High", "Urgent"];

/**
 * Statuses a request can move to from each status. A resolved request can be
 * reopened or closed; a closed request is final.
 */
export const STATUS_TRANSITIONS: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  Open: ["In Progress", "On Hold", "Resolved"],
  "In Progress": ["On Hold", "Resolved"],
  "On Hold": ["In Progress", "Resolved"],
  Resolved: ["Closed", "Open"],
  Closed: [],
};

export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_NOTE_LENGTH = 1000;

export function isUnresolved(status: MaintenanceStatus): boolean {
  return UNRESOLVED_STATUSES.includes(status);
}

export function isHighPriority(priority: MaintenancePriority): boolean {
  return HIGH_PRIORITIES.includes(priority);
}

/** Days past its target date an unresolved request is; 0 when not overdue. */
export function getDaysOverdue(request: MaintenanceRequest, today: string): number {
  if (!request.targetResolutionDate || !isUnresolved(request.status)) return 0;
  return Math.max(0, daysBetween(request.targetResolutionDate, today));
}

export function isOverdue(request: MaintenanceRequest, today: string): boolean {
  return getDaysOverdue(request, today) > 0;
}

export type MaintenanceSummary = {
  total: number;
  open: number;
  inProgress: number;
  onHold: number;
  resolved: number;
  closed: number;
  unresolved: number;
  /** Unresolved requests of High or Urgent priority. */
  highPriority: number;
  /** Unresolved Urgent requests. */
  urgent: number;
};

export function summarizeMaintenance(requests: MaintenanceRequest[]): MaintenanceSummary {
  const count = (status: MaintenanceStatus) =>
    requests.filter((request) => request.status === status).length;
  const unresolved = requests.filter((request) => isUnresolved(request.status));
  return {
    total: requests.length,
    open: count("Open"),
    inProgress: count("In Progress"),
    onHold: count("On Hold"),
    resolved: count("Resolved"),
    closed: count("Closed"),
    unresolved: unresolved.length,
    highPriority: unresolved.filter((request) => isHighPriority(request.priority)).length,
    urgent: unresolved.filter((request) => request.priority === "Urgent").length,
  };
}

export type MaintenanceAlerts = {
  /** Unresolved Urgent requests, most overdue then most recent first. */
  urgent: MaintenanceRequest[];
  /** Unresolved High-priority requests past their target date, most overdue first. */
  overdueHighPriority: MaintenanceRequest[];
};

export function getMaintenanceAlerts(
  requests: MaintenanceRequest[],
  today: string,
): MaintenanceAlerts {
  const byUrgency = (a: MaintenanceRequest, b: MaintenanceRequest) =>
    getDaysOverdue(b, today) - getDaysOverdue(a, today) || compareByReported(a, b);
  return {
    urgent: requests
      .filter((request) => isUnresolved(request.status) && request.priority === "Urgent")
      .sort(byUrgency),
    overdueHighPriority: requests
      .filter((request) => request.priority === "High" && isOverdue(request, today))
      .sort(byUrgency),
  };
}

/** Most recently reported first. */
export function compareByReported(a: MaintenanceRequest, b: MaintenanceRequest): number {
  return b.reportedAt.localeCompare(a.reportedAt) || b.createdAt.localeCompare(a.createdAt);
}

/** Unresolved first, then most recently reported. */
export function compareForProfile(a: MaintenanceRequest, b: MaintenanceRequest): number {
  const open = Number(isUnresolved(b.status)) - Number(isUnresolved(a.status));
  return open || compareByReported(a, b);
}

// Associations

export type PortfolioRecords = {
  properties: Property[];
  units: RentalUnit[];
  tenants: Tenant[];
  tenancies: Tenancy[];
};

/** True if the tenancy had the unit on `date`: moved in by then and not yet moved out. */
export function tenancyCoversDate(tenancy: Tenancy, date: string): boolean {
  if (tenancy.moveInDate > date) return false;
  return tenancy.status === "Active" || (!!tenancy.moveOutDate && date <= tenancy.moveOutDate);
}

/**
 * The tenancy a tenant held on `date` at the unit, or at any unit of the
 * property when no unit is given. Prefers the latest move-in on move days.
 */
export function findTenancyOnDate(
  records: Pick<PortfolioRecords, "units" | "tenancies">,
  { tenantId, propertyId, unitId, date }: {
    tenantId: string;
    propertyId: string;
    unitId?: string;
    date: string;
  },
): Tenancy | undefined {
  const unitIds = unitId
    ? [unitId]
    : records.units.filter((unit) => unit.propertyId === propertyId).map((unit) => unit.id);
  return records.tenancies
    .filter(
      (tenancy) =>
        tenancy.tenantId === tenantId &&
        unitIds.includes(tenancy.unitId) &&
        tenancyCoversDate(tenancy, date),
    )
    .sort((a, b) => b.moveInDate.localeCompare(a.moveInDate))[0];
}

export type EligibleTenant = { tenant: Tenant; tenancy: Tenancy };

/** Tenants who rented the unit (or any unit of the property) on `date`. */
export function getEligibleTenants(
  records: PortfolioRecords,
  { propertyId, unitId, date }: { propertyId: string; unitId?: string; date: string },
): EligibleTenant[] {
  if (!propertyId) return [];
  const eligible: EligibleTenant[] = [];
  for (const tenant of records.tenants) {
    const tenancy = findTenancyOnDate(records, { tenantId: tenant.id, propertyId, unitId, date });
    if (tenancy) eligible.push({ tenant, tenancy });
  }
  return eligible.sort((a, b) => a.tenant.fullName.localeCompare(b.tenant.fullName));
}

export type AssociationFields = {
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  reportedAt: string;
};

export type AssociationCheck =
  | { ok: true; tenancyId?: string }
  | { ok: false; errors: Partial<Record<"propertyId" | "unitId" | "tenantId", string>> };

/**
 * Checks that the unit belongs to the property and that the tenant held a
 * tenancy there on the reported date. Returns that tenancy's id.
 */
export function checkAssociations(
  fields: AssociationFields,
  records: PortfolioRecords,
): AssociationCheck {
  const property = records.properties.find((candidate) => candidate.id === fields.propertyId);
  if (!property) return { ok: false, errors: { propertyId: "Choose the property with the issue." } };

  let unit: RentalUnit | undefined;
  if (fields.unitId) {
    unit = records.units.find((candidate) => candidate.id === fields.unitId);
    if (!unit) return { ok: false, errors: { unitId: "That rental unit no longer exists." } };
    if (unit.propertyId !== property.id) {
      return {
        ok: false,
        errors: { unitId: `Unit ${unit.unitNumber} isn't part of ${property.name}.` },
      };
    }
  }

  if (!fields.tenantId) return { ok: true };
  const tenant = records.tenants.find((candidate) => candidate.id === fields.tenantId);
  if (!tenant) return { ok: false, errors: { tenantId: "That tenant no longer exists." } };

  const tenancy = findTenancyOnDate(records, {
    tenantId: tenant.id,
    propertyId: property.id,
    unitId: unit?.id,
    date: fields.reportedAt,
  });
  if (tenancy) return { ok: true, tenancyId: tenancy.id };

  const place = unit ? `unit ${unit.unitNumber}` : property.name;
  return {
    ok: false,
    errors: {
      tenantId: `${tenant.fullName} wasn't renting ${place} on ${formatDate(fields.reportedAt)}. Choose a tenant who was, change the reported date, or leave the tenant blank.`,
    },
  };
}

// Display

export type MaintenanceRow = {
  request: MaintenanceRequest;
  property?: Property;
  unit?: RentalUnit;
  tenant?: Tenant;
  tenancy?: Tenancy;
  vendor?: Vendor;
  /** "Lakeview Residency, B-101" or "Lakeview Residency · Whole property". */
  location: string;
};

export function resolveMaintenanceRow(
  request: MaintenanceRequest,
  records: PortfolioRecords & { vendors: Vendor[] },
): MaintenanceRow {
  const property = records.properties.find((candidate) => candidate.id === request.propertyId);
  const unit = request.unitId
    ? records.units.find((candidate) => candidate.id === request.unitId)
    : undefined;
  const propertyName = property?.name ?? "Unknown property";
  return {
    request,
    property,
    unit,
    tenant: request.tenantId
      ? records.tenants.find((candidate) => candidate.id === request.tenantId)
      : undefined,
    tenancy: request.tenancyId
      ? records.tenancies.find((candidate) => candidate.id === request.tenancyId)
      : undefined,
    vendor: request.assignedVendorId
      ? records.vendors.find((candidate) => candidate.id === request.assignedVendorId)
      : undefined,
    location: request.unitId
      ? `${propertyName}, ${unit?.unitNumber ?? "unknown unit"}`
      : `${propertyName} · Whole property`,
  };
}
