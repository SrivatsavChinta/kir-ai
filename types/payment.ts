// Dates are calendar dates (YYYY-MM-DD) in IST. Amounts are whole rupees.

export type PaymentMethod = "Cash" | "Bank transfer" | "UPI" | "Cheque" | "Other";

/**
 * Money actually received from a tenant. Payments belong to a tenancy, not a
 * unit, and are kept after the tenancy ends.
 */
export type Payment = {
  id: string;
  tenancyId: string;
  /** The rent obligation this payment settles, when allocated to one. */
  obligationId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  notes?: string;
  /** When the payment row was stored. Omitted on input. */
  recordedAt?: string;
};

export type PaymentInput = Omit<Payment, "id">;
