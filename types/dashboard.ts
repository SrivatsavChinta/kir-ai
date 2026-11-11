import type { DocumentRecord } from "@/types/document";
import type {
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceStatus,
} from "@/types/maintenance";
import type { Payment } from "@/types/payment";
import type { Property, RentalUnit } from "@/types/property";
import type { RentObligation } from "@/types/rent-obligation";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";

// Source records. Dates without a time are calendar dates (YYYY-MM-DD) in IST;
// timestamps are ISO 8601 strings with an offset.

export type ActivityType =
  | "payment_received"
  | "tenant_added"
  | "maintenance_created"
  | "document_uploaded";

/** A fictional event from before the session; not derived from the records. */
export type ActivityEvent = {
  id: string;
  type: ActivityType;
  title: string;
  unitId: string;
  tenantId?: string;
  amount?: number;
  occurredAt: string;
};

/** Operational records the dashboard needs beyond the portfolio and payments. */
export type DashboardRecords = {
  asOf: string;
  /** Static sample activity kept for the demo seed's reference time. */
  activity: ActivityEvent[];
};

export type DashboardData = {
  asOf: string;
  properties: Property[];
  units: RentalUnit[];
  tenants: Tenant[];
  tenancies: Tenancy[];
  payments: Payment[];
  obligations: RentObligation[];
  maintenanceRequests: MaintenanceRequest[];
  documents: DocumentRecord[];
};

// Derived view consumed by the dashboard UI.

export type PortfolioSummary = {
  propertyCount: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyPercent: number;
};

export type RentCollectionSummary = {
  periodLabel: string;
  expected: number;
  collected: number;
  outstanding: number;
  overdue: number;
  notYetDue: number;
  collectedPercent: number;
  tenantsBilled: number;
  tenantsPaidInFull: number;
};

export type OverdueRent = {
  tenancyId: string;
  tenantId: string;
  tenantName: string;
  location: string;
  balance: number;
  daysOverdue: number;
};

export type MaintenanceAlert = {
  id: string;
  title: string;
  location: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedAt: string;
  targetResolutionDate?: string;
  /** 0 when not past the target date. */
  daysOverdue: number;
};

export type MaintenanceAlerts = {
  /** Unresolved Urgent requests. */
  urgent: MaintenanceAlert[];
  /** Unresolved High-priority requests past their target date. */
  overdueHighPriority: MaintenanceAlert[];
};

export type ExpiringAgreement = {
  tenancyId: string;
  tenantId: string;
  tenantName: string;
  location: string;
  endDate: string;
  daysRemaining: number;
};

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  context: string;
  tenantId?: string;
  amount?: number;
  occurredAt: string;
};

export type DashboardOverview = {
  asOf: string;
  portfolio: PortfolioSummary;
  rent: RentCollectionSummary;
  overdueRent: OverdueRent[];
  maintenance: MaintenanceAlerts;
  expiringAgreements: ExpiringAgreement[];
  activity: ActivityItem[];
};
