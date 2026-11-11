import { daysBetween, toCalendarDate } from "@/lib/dates";
import { describeAssociation, resolveAssociation } from "@/lib/documents";
import { getDaysOverdue, getMaintenanceAlerts } from "@/lib/maintenance";
import { buildRentLedger, formatBillingMonth, summarizeRentMonth } from "@/lib/rent-calculations";
import { AGREEMENT_EXPIRY_WINDOW_DAYS } from "@/lib/tenants";
import type {
  ActivityItem,
  DashboardData,
  DashboardOverview,
  ExpiringAgreement,
  MaintenanceAlert,
  OverdueRent,
} from "@/types/dashboard";
import type { MaintenanceRequest } from "@/types/maintenance";
import type { Payment } from "@/types/payment";
import type { RentalUnit } from "@/types/property";

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

export function getDashboardOverview(data: DashboardData): DashboardOverview {
  const today = toCalendarDate(data.asOf);
  const currentMonth = today.slice(0, 7);

  const propertyById = new Map(data.properties.map((p) => [p.id, p]));
  const unitById = new Map(data.units.map((u) => [u.id, u]));
  const tenantNameById = new Map(data.tenants.map((t) => [t.id, t.fullName]));

  const locationOf = (unit: RentalUnit) =>
    `${propertyById.get(unit.propertyId)?.name ?? "Unknown property"}, ${unit.unitNumber}`;

  const occupiedUnits = data.units.filter((unit) => unit.status === "Occupied");

  const expiringAgreements: ExpiringAgreement[] = [];
  for (const tenancy of data.tenancies) {
    const unit = unitById.get(tenancy.unitId);
    if (!unit || tenancy.status !== "Active") continue;
    const daysRemaining = daysBetween(today, tenancy.agreementEndDate);
    if (daysRemaining >= 0 && daysRemaining <= AGREEMENT_EXPIRY_WINDOW_DAYS) {
      expiringAgreements.push({
        tenancyId: tenancy.id,
        tenantId: tenancy.tenantId,
        tenantName: tenantNameById.get(tenancy.tenantId) ?? "Unknown tenant",
        location: locationOf(unit),
        endDate: tenancy.agreementEndDate,
        daysRemaining,
      });
    }
  }

  // Rent figures come from the same ledger the Rent & Payments module uses.
  const ledger = buildRentLedger(data, today);
  const rent = summarizeRentMonth(ledger, currentMonth);
  const overdueRent: OverdueRent[] = ledger
    .filter(
      (entry) =>
        entry.obligation.billingMonth === currentMonth && entry.status === "Overdue",
    )
    .map((entry) => ({
      tenancyId: entry.tenancy.id,
      tenantId: entry.tenancy.tenantId,
      tenantName: entry.tenantName,
      location: entry.location,
      balance: entry.balance,
      daysOverdue: entry.daysOverdue,
    }));

  // Maintenance alerts use the same status definitions as the Maintenance module.
  const toAlert = (request: MaintenanceRequest): MaintenanceAlert => {
    const unit = request.unitId ? unitById.get(request.unitId) : undefined;
    const propertyName = propertyById.get(request.propertyId)?.name ?? "Unknown property";
    return {
      id: request.id,
      title: request.title,
      location: unit ? locationOf(unit) : `${propertyName} · Whole property`,
      priority: request.priority,
      status: request.status,
      reportedAt: request.reportedAt,
      targetResolutionDate: request.targetResolutionDate,
      daysOverdue: getDaysOverdue(request, today),
    };
  };
  const alerts = getMaintenanceAlerts(data.maintenanceRequests, today);
  const activity = buildPortfolioActivity(data);

  return {
    asOf: data.asOf,
    portfolio: {
      propertyCount: data.properties.length,
      totalUnits: data.units.length,
      occupiedUnits: occupiedUnits.length,
      vacantUnits: data.units.length - occupiedUnits.length,
      occupancyPercent: percent(occupiedUnits.length, data.units.length),
    },
    rent: {
      periodLabel: formatBillingMonth(currentMonth),
      expected: rent.expected,
      collected: rent.collected,
      outstanding: rent.outstanding,
      overdue: rent.overdue,
      notYetDue: rent.notYetDue,
      collectedPercent: rent.collectedPercent,
      tenantsBilled: rent.obligationCount,
      tenantsPaidInFull: rent.paidInFullCount,
    },
    overdueRent: overdueRent.sort((a, b) => b.daysOverdue - a.daysOverdue),
    maintenance: {
      urgent: alerts.urgent.map(toAlert),
      overdueHighPriority: alerts.overdueHighPriority.map(toAlert),
    },
    expiringAgreements: expiringAgreements.sort(
      (a, b) => a.daysRemaining - b.daysRemaining,
    ),
    activity,
  };
}

function paymentOccurredAt(payment: Payment): string {
  if (payment.recordedAt && toCalendarDate(payment.recordedAt) === payment.paymentDate) {
    return payment.recordedAt;
  }
  return `${payment.paymentDate}T12:00:00+05:30`;
}

/** The latest payments, tenants, documents and maintenance for this landlord. */
function buildPortfolioActivity(data: DashboardData): ActivityItem[] {
  const tenancyById = new Map(data.tenancies.map((tenancy) => [tenancy.id, tenancy]));
  const tenantById = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  const unitById = new Map(data.units.map((unit) => [unit.id, unit]));
  const propertyById = new Map(data.properties.map((property) => [property.id, property]));
  const locationOf = (unitId: string) => {
    const unit = unitById.get(unitId);
    if (!unit) return "Unknown unit";
    return `${propertyById.get(unit.propertyId)?.name ?? "Unknown property"}, ${unit.unitNumber}`;
  };
  const items: ActivityItem[] = [];

  for (const payment of data.payments) {
    const tenancy = tenancyById.get(payment.tenancyId);
    if (!tenancy) continue;
    const tenant = tenantById.get(tenancy.tenantId);
    items.push({
      id: `payment-${payment.id}`,
      type: "payment_received",
      title: "Rent payment received",
      context: `${tenant?.fullName ?? "Unknown tenant"} · ${locationOf(tenancy.unitId)}`,
      tenantId: tenant?.id,
      amount: payment.amount,
      occurredAt: paymentOccurredAt(payment),
    });
  }

  for (const request of data.maintenanceRequests) {
    const place = request.unitId
      ? locationOf(request.unitId)
      : `${propertyById.get(request.propertyId)?.name ?? "Unknown property"} · Whole property`;
    const tenant = request.tenantId ? tenantById.get(request.tenantId) : undefined;
    items.push({
      id: `maintenance-${request.id}`,
      type: "maintenance_created",
      title: `Maintenance request: ${request.title}`,
      context: tenant ? `${tenant.fullName} · ${place}` : place,
      tenantId: tenant?.id,
      occurredAt: request.createdAt,
    });
  }

  for (const document of data.documents) {
    const resolved = resolveAssociation(document, data);
    items.push({
      id: `document-${document.id}`,
      type: "document_uploaded",
      title: `${document.name} uploaded`,
      context: describeAssociation(resolved),
      tenantId: resolved.tenant?.id,
      occurredAt: document.uploadedAt,
    });
  }

  for (const tenant of data.tenants) {
    const first = data.tenancies
      .filter((tenancy) => tenancy.tenantId === tenant.id)
      .sort((a, b) => a.moveInDate.localeCompare(b.moveInDate))[0];
    if (!first) continue;
    items.push({
      id: `tenant-${tenant.id}`,
      type: "tenant_added",
      title: "New tenant added",
      context: `${tenant.fullName} · ${locationOf(first.unitId)}`,
      tenantId: tenant.id,
      occurredAt: `${first.moveInDate}T10:00:00+05:30`,
    });
  }

  return items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 8);
}
