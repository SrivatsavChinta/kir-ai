"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { usePaymentConfirmation } from "@/components/payments/payment-confirmation";
import { PaymentHistoryList } from "@/components/payments/payment-history";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { RecordPaymentDialog } from "@/components/payments/record-payment-form";
import { usePortfolio } from "@/components/portfolio-provider";
import { useFormatters } from "@/components/settings/settings-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatINR, pluralize } from "@/lib/format";
import { buildRentLedger, formatBillingMonth, getPaymentHistory } from "@/lib/rent-calculations";

/** Outstanding rent and every payment across a tenant's tenancies, ended ones included. */
export function TenantRentHistory({ tenantId }: { tenantId: string }) {
  const { today, tenancies, tenants, units, properties, payments, obligations } = usePortfolio();
  const { formatDate } = useFormatters();
  const [dialog, setDialog] = useState({ open: false, key: 0 });
  const { confirmPayment, clearNotice } = usePaymentConfirmation();

  const ledger = useMemo(
    () => buildRentLedger({ tenancies, tenants, units, properties, payments, obligations }, today),
    [tenancies, tenants, units, properties, payments, obligations, today],
  );
  const tenancyIds = tenancies
    .filter((tenancy) => tenancy.tenantId === tenantId)
    .map((tenancy) => tenancy.id);
  const unpaid = ledger
    .filter((entry) => tenancyIds.includes(entry.tenancy.id) && entry.balance > 0)
    .sort((a, b) => a.obligation.dueDate.localeCompare(b.obligation.dueDate));
  const outstanding = unpaid.reduce((total, entry) => total + entry.balance, 0);
  const history = getPaymentHistory(tenancyIds, { tenancies, payments, obligations });
  const received = history.reduce((total, item) => total + item.payment.amount, 0);

  const locationOf = (unitId?: string) => {
    const unit = units.find((candidate) => candidate.id === unitId);
    const property = properties.find((candidate) => candidate.id === unit?.propertyId);
    return unit ? `${property?.name ?? "Unknown property"}, ${unit.unitNumber}` : undefined;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Rent history
        </CardTitle>
        <CardDescription>
          {formatINR(received)} received in {pluralize(history.length, "payment")} ·{" "}
          {outstanding > 0 ? `${formatINR(outstanding)} outstanding` : "nothing outstanding"}
        </CardDescription>
        {outstanding > 0 && (
          <CardAction>
            <Button
              variant="outline"
              onClick={() => {
                clearNotice();
                setDialog((state) => ({ open: true, key: state.key + 1 }));
              }}
            >
              <Plus data-icon="inline-start" />
              Record payment
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {unpaid.length > 0 && (
          <section aria-label="Unpaid rent" className="space-y-2">
            <h3 className="text-sm font-medium">Unpaid rent</h3>
            <ul className="divide-y rounded-lg border">
              {unpaid.map((entry) => (
                <li
                  key={entry.obligation.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {formatBillingMonth(entry.obligation.billingMonth)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(entry.obligation.dueDate)}
                      {tenancyIds.length > 1 ? ` · ${entry.location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">{formatINR(entry.balance)}</span>
                    <PaymentStatusBadge status={entry.status} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Payments" className="space-y-2">
          <h3 className="text-sm font-medium">Payments, most recent first</h3>
          <PaymentHistoryList
            items={history}
            locationOf={
              tenancyIds.length > 1 ? (item) => locationOf(item.tenancy?.unitId) : undefined
            }
            emptyMessage="No payments recorded for this tenant yet."
          />
        </section>

        <Link href="/payments" className={buttonVariants({ variant: "link", className: "px-0" })}>
          Open Rent &amp; Payments
        </Link>
      </CardContent>

      <RecordPaymentDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        formKey={dialog.key}
        tenancyId={unpaid[0]?.tenancy.id}
        onRecorded={(payment) => confirmPayment(payment)}
      />
    </Card>
  );
}
