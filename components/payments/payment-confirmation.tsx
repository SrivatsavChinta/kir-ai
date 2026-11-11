"use client";

import { useNotice } from "@/components/feedback/notice";
import { usePortfolio } from "@/components/portfolio-provider";
import { useFormatters } from "@/components/settings/settings-provider";
import { formatINR } from "@/lib/format";
import { formatBillingMonth, getObligationBalance } from "@/lib/rent-calculations";
import type { Payment, PaymentMethod } from "@/types/payment";

function describeMethod(method: PaymentMethod): string {
  if (method === "Other") return "by another method";
  if (method === "UPI") return "by UPI";
  return `by ${method.toLowerCase()}`;
}

/** Describes a recorded payment and the balance it leaves, using the latest portfolio state. */
function PaymentRecordedMessage({ payment }: { payment: Payment }) {
  const { tenancies, tenants, payments, obligations } = usePortfolio();
  const { formatDate } = useFormatters();

  const tenancy = tenancies.find((candidate) => candidate.id === payment.tenancyId);
  const tenantName = tenants.find((tenant) => tenant.id === tenancy?.tenantId)?.fullName;
  const obligation = obligations.find(
    (candidate) => candidate.id === payment.obligationId && candidate.tenancyId === payment.tenancyId,
  );
  const month = obligation ? formatBillingMonth(obligation.billingMonth) : undefined;
  const balance = payment.obligationId
    ? getObligationBalance(payment.obligationId, payment.tenancyId, obligations, payments)
    : null;

  return (
    <>
      <p>
        {formatINR(payment.amount)} from {tenantName ?? "the tenant"}
        {month ? ` for ${month} rent` : ""}, received {formatDate(payment.paymentDate)}{" "}
        {describeMethod(payment.paymentMethod)}.
      </p>
      {balance !== null && (
        <p className="font-medium">
          {balance === 0
            ? `${month ?? "This month's"} rent is now paid in full.`
            : `${formatINR(balance)} is still outstanding for ${month ?? "this month"}.`}
        </p>
      )}
    </>
  );
}

/** Announces a recorded payment, optionally with a link to the tenancy's payment history. */
export function usePaymentConfirmation() {
  const { showNotice, clearNotice } = useNotice();
  return {
    clearNotice,
    confirmPayment(payment: Payment, onViewHistory?: (tenancyId: string) => void) {
      showNotice({
        tone: "success",
        title: "Payment recorded",
        message: <PaymentRecordedMessage payment={payment} />,
        action: onViewHistory
          ? {
              label: "View payment history",
              onClick: () => {
                clearNotice();
                onViewHistory(payment.tenancyId);
              },
            }
          : undefined,
      });
    },
  };
}
