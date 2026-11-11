import type { Payment } from "@/types/payment";
import type { Property, RentalUnit } from "@/types/property";
import type { Tenancy } from "@/types/tenancy";

/**
 * Rent a tenancy owes for one billing month. Obligations are derived from
 * tenancies by lib/rent-calculations.ts; their ids are stable, so payments can
 * refer to them.
 */
export type RentObligation = {
  id: string;
  tenancyId: string;
  /** YYYY-MM */
  billingMonth: string;
  /** YYYY-MM-DD */
  dueDate: string;
  expectedAmount: number;
};

export type RentStatus = "Paid" | "Partially paid" | "Pending" | "Overdue";

/** An obligation with its allocated payments and the tenancy it belongs to. */
export type RentLedgerEntry = {
  obligation: RentObligation;
  tenancy: Tenancy;
  tenantName: string;
  unit?: RentalUnit;
  property?: Property;
  /** e.g. "Lakeview Residency, A-101" */
  location: string;
  payments: Payment[];
  amountPaid: number;
  balance: number;
  status: RentStatus;
  /** Days past the due date; 0 until the day after it falls due. */
  daysOverdue: number;
};

export type RentMonthSummary = {
  billingMonth: string;
  expected: number;
  collected: number;
  outstanding: number;
  /** Outstanding balances whose due date has passed. */
  overdue: number;
  notYetDue: number;
  collectedPercent: number;
  obligationCount: number;
  paidInFullCount: number;
  /** Payments allocated to this month's obligations. */
  paymentCount: number;
  tenanciesWithBalance: number;
};
