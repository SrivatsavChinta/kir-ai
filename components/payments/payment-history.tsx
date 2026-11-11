"use client";

import { useMemo } from "react";
import { Plus, ReceiptIndianRupee } from "lucide-react";

import { InlineEmptyState } from "@/components/feedback/empty-state";
import { usePortfolio } from "@/components/portfolio-provider";
import { useFormatters } from "@/components/settings/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatINR, pluralize } from "@/lib/format";
import {
  buildRentLedger,
  formatBillingMonth,
  getPaymentHistory,
  type PaymentHistoryItem,
} from "@/lib/rent-calculations";

type PaymentHistoryListProps = {
  items: PaymentHistoryItem[];
  /** Labels each payment with its unit, for tenants with several tenancies. */
  locationOf?: (item: PaymentHistoryItem) => string | undefined;
  emptyMessage?: string;
};

/** Payments, most recent first. */
export function PaymentHistoryList({
  items,
  locationOf,
  emptyMessage = "No payments recorded yet.",
}: PaymentHistoryListProps) {
  const { formatDate } = useFormatters();
  if (items.length === 0) {
    return <InlineEmptyState icon={ReceiptIndianRupee}>{emptyMessage}</InlineEmptyState>;
  }

  return (
    <ol className="divide-y">
      {items.map((item) => {
        const { payment } = item;
        const location = locationOf?.(item);
        return (
          <li key={payment.id} className="space-y-1.5 py-3 text-sm first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold tabular-nums">{formatINR(payment.amount)}</p>
              <time dateTime={payment.paymentDate} className="shrink-0 text-muted-foreground">
                {formatDate(payment.paymentDate)}
              </time>
            </div>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div className="flex gap-1">
                <dt>For</dt>
                <dd className="font-medium text-foreground">
                  {item.billingMonth
                    ? `${formatBillingMonth(item.billingMonth)} rent`
                    : "Not allocated"}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>Method</dt>
                <dd className="font-medium text-foreground">{payment.paymentMethod}</dd>
              </div>
              <div className="flex min-w-0 gap-1">
                <dt>Reference</dt>
                <dd className="font-medium break-all text-foreground">
                  {payment.transactionReference ?? "—"}
                </dd>
              </div>
              {location && (
                <div className="flex gap-1">
                  <dt>Unit</dt>
                  <dd className="font-medium text-foreground">{location}</dd>
                </div>
              )}
            </dl>
            {payment.notes && (
              <p className="text-xs break-words text-muted-foreground">
                <span className="sr-only">Notes: </span>“{payment.notes}”
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

type PaymentHistorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kept while the sheet closes so its content doesn't vanish mid-animation. */
  tenancyId?: string;
  onRecordPayment: (tenancyId: string) => void;
};

/** One tenancy's payments and outstanding rent, including ended tenancies. */
export function PaymentHistorySheet({
  open,
  onOpenChange,
  tenancyId,
  onRecordPayment,
}: PaymentHistorySheetProps) {
  const { formatDate } = useFormatters();
  const { today, tenancies, tenants, units, properties, payments, obligations } = usePortfolio();
  const ledger = useMemo(
    () => buildRentLedger({ tenancies, tenants, units, properties, payments, obligations }, today),
    [tenancies, tenants, units, properties, payments, obligations, today],
  );

  const tenancy = tenancies.find((candidate) => candidate.id === tenancyId);
  const entries = ledger.filter((entry) => entry.tenancy.id === tenancyId);
  const history = tenancyId ? getPaymentHistory([tenancyId], { tenancies, payments, obligations }) : [];
  const unit = units.find((candidate) => candidate.id === tenancy?.unitId);
  const property = properties.find((candidate) => candidate.id === unit?.propertyId);
  const tenantName = tenants.find((tenant) => tenant.id === tenancy?.tenantId)?.fullName;
  const received = history.reduce((total, item) => total + item.payment.amount, 0);
  const outstanding = entries.reduce((total, entry) => total + entry.balance, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {tenancy && (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>Payment history</SheetTitle>
              <SheetDescription>
                {tenantName ?? "Unknown tenant"} · {property?.name ?? "Unknown property"},{" "}
                {unit?.unitNumber ?? "unknown unit"}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
                {tenancy.status === "Active" ? (
                  <Badge variant="secondary">Active tenancy</Badge>
                ) : (
                  <Badge variant="outline">Ended · {tenancy.endReason ?? "Moved out"}</Badge>
                )}
                <span>
                  {formatDate(tenancy.moveInDate)} –{" "}
                  {tenancy.moveOutDate ? formatDate(tenancy.moveOutDate) : "present"}
                </span>
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4">
              <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Received</dt>
                  <dd className="font-semibold tabular-nums">{formatINR(received)}</dd>
                  <dd className="text-xs text-muted-foreground">
                    {pluralize(history.length, "payment")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Outstanding</dt>
                  <dd className="font-semibold tabular-nums">{formatINR(outstanding)}</dd>
                  <dd className="text-xs text-muted-foreground">
                    {pluralize(entries.filter((entry) => entry.balance > 0).length, "month")}{" "}
                    unpaid
                  </dd>
                </div>
              </dl>
              <section aria-label="Payments" className="space-y-2">
                <h3 className="text-sm font-medium">Payments, most recent first</h3>
                <PaymentHistoryList items={history} />
              </section>
            </div>

            {outstanding > 0 && (
              <SheetFooter>
                <Button onClick={() => onRecordPayment(tenancy.id)}>
                  <Plus data-icon="inline-start" />
                  Record payment
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
