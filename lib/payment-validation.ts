import { isCalendarDate } from "@/lib/dates";
import { formatDate, formatINR } from "@/lib/format";
import { formatBillingMonth, PAYMENT_METHODS } from "@/lib/rent-calculations";
import {
  hasErrors,
  parseWholeNumber,
  type FieldErrors,
  type ValidationResult,
} from "@/lib/validation";
import type { PaymentInput, PaymentMethod } from "@/types/payment";
import type { RentLedgerEntry } from "@/types/rent-obligation";
import type { Tenancy } from "@/types/tenancy";

export const MAX_REFERENCE_LENGTH = 60;
export const MAX_NOTES_LENGTH = 300;

export type PaymentFormValues = {
  tenancyId: string;
  obligationId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod | "";
  transactionReference: string;
  notes: string;
};

export type PaymentValidationContext = {
  tenancies: Tenancy[];
  ledger: RentLedgerEntry[];
  /** Payments can't be dated after this day (YYYY-MM-DD). */
  today: string;
};

/** Earliest date a payment for the tenancy can be recorded on. */
export function getEarliestPaymentDate(tenancy: Tenancy): string {
  return tenancy.agreementStartDate < tenancy.moveInDate
    ? tenancy.agreementStartDate
    : tenancy.moveInDate;
}

export function validatePaymentForm(
  values: PaymentFormValues,
  { tenancies, ledger, today }: PaymentValidationContext,
): ValidationResult<PaymentInput, PaymentFormValues> {
  const errors: FieldErrors<PaymentFormValues> = {};

  const tenancy = tenancies.find((candidate) => candidate.id === values.tenancyId);
  if (!values.tenancyId) errors.tenancyId = "Select the tenant who paid.";
  else if (!tenancy) errors.tenancyId = "That tenancy no longer exists.";

  const entry = ledger.find(
    (candidate) =>
      candidate.obligation.id === values.obligationId &&
      candidate.tenancy.id === values.tenancyId,
  );
  if (tenancy) {
    if (!values.obligationId) errors.obligationId = "Select the rent this payment is for.";
    else if (!entry) errors.obligationId = "That rent isn't billed to this tenancy.";
    else if (entry.balance === 0) {
      errors.obligationId = `${formatBillingMonth(entry.obligation.billingMonth)} rent has already been paid in full.`;
    }
  }

  let amount = 0;
  const parsedAmount = parseWholeNumber(values.amount);
  if (!values.amount.trim()) errors.amount = "Enter the amount received.";
  else if (parsedAmount === null) errors.amount = "Enter the amount as a whole number of rupees.";
  else if (parsedAmount <= 0) errors.amount = "Payment amount must be more than ₹0.";
  else if (entry && entry.balance > 0 && parsedAmount > entry.balance) {
    errors.amount = `Only ${formatINR(entry.balance)} is outstanding for ${formatBillingMonth(entry.obligation.billingMonth)}. Enter that amount or less.`;
  } else amount = parsedAmount;

  if (!values.paymentDate) errors.paymentDate = "Enter the date the payment was received.";
  else if (!isCalendarDate(values.paymentDate)) errors.paymentDate = "Enter a valid date.";
  else if (values.paymentDate > today) {
    errors.paymentDate = `Payment date can't be in the future (after ${formatDate(today)}).`;
  } else if (tenancy && values.paymentDate < getEarliestPaymentDate(tenancy)) {
    errors.paymentDate = `Payment date can't be before the tenancy began (${formatDate(getEarliestPaymentDate(tenancy))}).`;
  }

  const paymentMethod = values.paymentMethod;
  if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
    errors.paymentMethod = "Select how the tenant paid.";
  }

  const transactionReference = values.transactionReference.trim();
  if (transactionReference.length > MAX_REFERENCE_LENGTH) {
    errors.transactionReference = `Reference must be ${MAX_REFERENCE_LENGTH} characters or fewer.`;
  }

  const notes = values.notes.trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    errors.notes = `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`;
  }

  if (hasErrors(errors) || !entry || !paymentMethod) return { success: false, errors };

  return {
    success: true,
    data: {
      tenancyId: values.tenancyId,
      obligationId: entry.obligation.id,
      amount,
      paymentDate: values.paymentDate,
      paymentMethod,
      transactionReference: transactionReference || undefined,
      notes: notes || undefined,
    },
  };
}
