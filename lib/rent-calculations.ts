import { daysBetween } from "@/lib/dates";
import { formatINR, formatMonth } from "@/lib/format";
import type { Payment, PaymentMethod } from "@/types/payment";
import type { Property, RentalUnit } from "@/types/property";
import type {
  RentLedgerEntry,
  RentMonthSummary,
  RentObligation,
  RentStatus,
} from "@/types/rent-obligation";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";

// The single source of rent figures for the Rent & Payments module and the
// dashboard. Stored obligations are the bills. generateRentObligations only
// decides which months still need a first snapshot; it does not price a month
// that already has a row. Payments are records allocated to those rows.

/**
 * First billing month kir.ai tracks. Rent for earlier months is treated as
 * settled outside the app, so it isn't billed or shown as owed.
 */
export const RENT_TRACKING_START_MONTH = "2026-09";

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "UPI",
  "Bank transfer",
  "Cash",
  "Cheque",
  "Other",
];

export const RENT_STATUSES: readonly RentStatus[] = [
  "Overdue",
  "Pending",
  "Partially paid",
  "Paid",
];

/** "2026-11" → "November 2026". */
export const formatBillingMonth = formatMonth;

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 12
    ? `${year + 1}-01`
    : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
}

/** Billing months from the tracking start to the month containing `today`, newest first. */
export function getBillingMonths(today: string): string[] {
  const months: string[] = [];
  const current = today.slice(0, 7);
  for (let month = RENT_TRACKING_START_MONTH; month <= current; month = nextMonth(month)) {
    months.push(month);
  }
  return months.reverse();
}

export function getObligationId(tenancyId: string, billingMonth: string): string {
  return `rent-${tenancyId}-${billingMonth}`;
}

/** Whether the tenancy held its unit on a date. */
function heldOn(tenancy: Tenancy, date: string): boolean {
  return (
    tenancy.moveInDate <= date &&
    (tenancy.status === "Active" || (tenancy.moveOutDate ?? "") >= date)
  );
}

/**
 * The tenancy's rent obligation for a billing month, or null if the month isn't
 * billed. A month is billed at the full agreed rent (no proration) if the tenant
 * held the unit on that month's due date. In the move-in month rent falls due on
 * the move-in date if that is after the usual due day. A tenant who moves unit
 * mid-month can therefore be billed by both tenancies that month.
 */
export function getObligationForMonth(
  tenancy: Tenancy,
  billingMonth: string,
  today: string,
): RentObligation | null {
  if (tenancy.moveInDate > today || tenancy.moveInDate.slice(0, 7) > billingMonth) {
    return null;
  }
  const usualDueDate = `${billingMonth}-${String(tenancy.rentDueDay).padStart(2, "0")}`;
  const dueDate = tenancy.moveInDate > usualDueDate ? tenancy.moveInDate : usualDueDate;
  if (!heldOn(tenancy, dueDate)) return null;

  return {
    id: getObligationId(tenancy.id, billingMonth),
    tenancyId: tenancy.id,
    billingMonth,
    dueDate,
    expectedAmount: tenancy.monthlyRent,
  };
}

export function generateRentObligations(
  tenancies: Tenancy[],
  today: string,
): RentObligation[] {
  const months = getBillingMonths(today);
  return tenancies.flatMap((tenancy) =>
    months.flatMap((month) => getObligationForMonth(tenancy, month, today) ?? []),
  );
}

/** Amount allocated to each obligation id. */
function sumByObligation(payments: Payment[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.obligationId) continue;
    totals.set(payment.obligationId, (totals.get(payment.obligationId) ?? 0) + payment.amount);
  }
  return totals;
}

export function getRentStatus(
  expectedAmount: number,
  amountPaid: number,
  dueDate: string,
  today: string,
): RentStatus {
  if (amountPaid >= expectedAmount) return "Paid";
  // An unpaid balance is overdue from the day after the due date.
  if (daysBetween(dueDate, today) > 0) return "Overdue";
  return amountPaid > 0 ? "Partially paid" : "Pending";
}

export type RentData = {
  tenancies: Tenancy[];
  tenants: Tenant[];
  units: RentalUnit[];
  properties: Property[];
  payments: Payment[];
  /** Persisted bills. Balances are expected amount minus allocated payments. */
  obligations: RentObligation[];
};

/** Every obligation in the tracked period with its payments, newest month first. */
export function buildRentLedger(data: RentData, today: string): RentLedgerEntry[] {
  const tenancyById = new Map(data.tenancies.map((tenancy) => [tenancy.id, tenancy]));
  const tenantNameById = new Map(data.tenants.map((tenant) => [tenant.id, tenant.fullName]));
  const unitById = new Map(data.units.map((unit) => [unit.id, unit]));
  const propertyById = new Map(data.properties.map((property) => [property.id, property]));

  const paymentsByObligation = new Map<string, Payment[]>();
  for (const payment of data.payments) {
    if (!payment.obligationId) continue;
    const list = paymentsByObligation.get(payment.obligationId) ?? [];
    list.push(payment);
    paymentsByObligation.set(payment.obligationId, list);
  }

  return data.obligations
    .map((obligation): RentLedgerEntry | null => {
      const tenancy = tenancyById.get(obligation.tenancyId);
      if (!tenancy) return null;
      const unit = unitById.get(tenancy.unitId);
      const property = unit ? propertyById.get(unit.propertyId) : undefined;
      const payments = paymentsByObligation.get(obligation.id) ?? [];
      const amountPaid = payments.reduce((total, payment) => total + payment.amount, 0);
      const balance = Math.max(obligation.expectedAmount - amountPaid, 0);
      const status = getRentStatus(obligation.expectedAmount, amountPaid, obligation.dueDate, today);
      return {
        obligation,
        tenancy,
        tenantName: tenantNameById.get(tenancy.tenantId) ?? "Unknown tenant",
        unit,
        property,
        location: `${property?.name ?? "Unknown property"}, ${unit?.unitNumber ?? "unknown unit"}`,
        payments,
        amountPaid,
        balance,
        status,
        daysOverdue: status === "Overdue" ? daysBetween(obligation.dueDate, today) : 0,
      };
    })
    .filter((entry): entry is RentLedgerEntry => entry !== null)
    .sort(
      (a, b) =>
        b.obligation.billingMonth.localeCompare(a.obligation.billingMonth) ||
        a.obligation.dueDate.localeCompare(b.obligation.dueDate) ||
        a.tenantName.localeCompare(b.tenantName),
    );
}

export function summarizeRentMonth(
  entries: RentLedgerEntry[],
  billingMonth: string,
): RentMonthSummary {
  let expected = 0;
  let collected = 0;
  let overdue = 0;
  let obligationCount = 0;
  let paidInFullCount = 0;
  let paymentCount = 0;
  const tenanciesWithBalance = new Set<string>();

  for (const entry of entries) {
    if (entry.obligation.billingMonth !== billingMonth) continue;
    obligationCount += 1;
    expected += entry.obligation.expectedAmount;
    collected += entry.obligation.expectedAmount - entry.balance;
    paymentCount += entry.payments.length;
    if (entry.balance === 0) paidInFullCount += 1;
    else tenanciesWithBalance.add(entry.tenancy.id);
    if (entry.status === "Overdue") overdue += entry.balance;
  }

  const outstanding = expected - collected;
  return {
    billingMonth,
    expected,
    collected,
    outstanding,
    overdue,
    notYetDue: outstanding - overdue,
    collectedPercent: expected === 0 ? 0 : (collected / expected) * 100,
    obligationCount,
    paidInFullCount,
    paymentCount,
    tenanciesWithBalance: tenanciesWithBalance.size,
  };
}

/** Unpaid balances from billing months before `billingMonth`. */
export function getEarlierArrears(entries: RentLedgerEntry[], billingMonth: string) {
  let amount = 0;
  const tenancyIds = new Set<string>();
  for (const entry of entries) {
    if (entry.obligation.billingMonth >= billingMonth || entry.balance === 0) continue;
    amount += entry.balance;
    tenancyIds.add(entry.tenancy.id);
  }
  return { amount, tenancyCount: tenancyIds.size };
}

/** A tenancy's obligations that still have a balance, oldest first. */
export function getOpenObligations(
  entries: RentLedgerEntry[],
  tenancyId: string,
): RentLedgerEntry[] {
  return entries
    .filter((entry) => entry.tenancy.id === tenancyId && entry.balance > 0)
    .sort((a, b) => a.obligation.dueDate.localeCompare(b.obligation.dueDate));
}

/** Balance still owed on an obligation, or null if the tenancy isn't billed it. */
export function getObligationBalance(
  obligationId: string,
  tenancyId: string,
  obligations: RentObligation[],
  payments: Payment[],
): number | null {
  const obligation = obligations.find(
    (candidate) => candidate.id === obligationId && candidate.tenancyId === tenancyId,
  );
  if (!obligation) return null;
  const paid = sumByObligation(payments).get(obligationId) ?? 0;
  return Math.max(obligation.expectedAmount - paid, 0);
}

/**
 * Checks that the given tenancies still bill every month their payments are
 * allocated to, for at least the amount paid. Returns a message if a tenancy
 * change would orphan or overpay recorded payments.
 */
export function findPaymentConflict(
  tenancies: Tenancy[],
  payments: Payment[],
  obligations: RentObligation[],
  today: string,
  tenancyIds: string[],
): string | null {
  const tenancyById = new Map(tenancies.map((tenancy) => [tenancy.id, tenancy]));
  const obligationById = new Map(obligations.map((obligation) => [obligation.id, obligation]));
  const paidByObligation = sumByObligation(
    payments.filter((payment) => tenancyIds.includes(payment.tenancyId)),
  );

  for (const [obligationId, paid] of paidByObligation) {
    const obligation = obligationById.get(obligationId);
    if (!obligation) {
      return `${formatINR(paid)} has already been recorded against a rent month this change would no longer bill. Recorded payments are kept, so choose a date that keeps that month billed.`;
    }
    const tenancy = tenancyById.get(obligation.tenancyId);
    const stillBilled = tenancy
      ? getObligationForMonth(tenancy, obligation.billingMonth, today)
      : null;
    const month = formatBillingMonth(obligation.billingMonth);
    if (!stillBilled) {
      return `${formatINR(paid)} has already been recorded against ${month} rent, which this change would no longer bill. Recorded payments are kept, so choose a date that keeps that month billed.`;
    }
    if (paid > obligation.expectedAmount) {
      return `${formatINR(paid)} has already been recorded against ${month} rent, more than the billed rent of ${formatINR(obligation.expectedAmount)}.`;
    }
  }
  return null;
}

export type PaymentHistoryItem = {
  payment: Payment;
  /** YYYY-MM of the obligation the payment settles, if allocated. */
  billingMonth?: string;
  tenancy?: Tenancy;
};

/** Payments for the given tenancies, most recent first. */
export function getPaymentHistory(
  tenancyIds: string[],
  data: { tenancies: Tenancy[]; payments: Payment[]; obligations: RentObligation[] },
): PaymentHistoryItem[] {
  const monthByObligation = new Map(
    data.obligations.map((obligation) => [obligation.id, obligation.billingMonth]),
  );
  const tenancyById = new Map(data.tenancies.map((tenancy) => [tenancy.id, tenancy]));

  // Payments are stored in the order they were recorded, which breaks same-day ties.
  return data.payments
    .map((payment, order) => ({ payment, order }))
    .filter(({ payment }) => tenancyIds.includes(payment.tenancyId))
    .sort(
      (a, b) =>
        b.payment.paymentDate.localeCompare(a.payment.paymentDate) || b.order - a.order,
    )
    .map(({ payment }) => ({
      payment,
      billingMonth: payment.obligationId ? monthByObligation.get(payment.obligationId) : undefined,
      tenancy: tenancyById.get(payment.tenancyId),
    }));
}
