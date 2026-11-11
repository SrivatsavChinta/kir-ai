import Link from "next/link";
import { Building2, History, Plus } from "lucide-react";

import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { useFormatters } from "@/components/settings/settings-provider";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatINR, pluralize } from "@/lib/format";
import { formatBillingMonth } from "@/lib/rent-calculations";
import type { RentLedgerEntry } from "@/types/rent-obligation";

export type RentLedgerRowActions = {
  onRecordPayment: (entry: RentLedgerEntry) => void;
  onViewHistory: (entry: RentLedgerEntry) => void;
};

type RentLedgerRowProps = RentLedgerRowActions & { entry: RentLedgerEntry };

function TenantLink({ entry }: { entry: RentLedgerEntry }) {
  return (
    <Link
      href={`/tenants/${entry.tenancy.tenantId}`}
      className="underline-offset-4 hover:underline"
    >
      {entry.tenantName}
    </Link>
  );
}

function StatusDetail({ entry }: { entry: RentLedgerEntry }) {
  if (entry.status === "Overdue") {
    return (
      <span className="block text-xs text-muted-foreground">
        {pluralize(entry.daysOverdue, "day")} late{entry.amountPaid > 0 ? " · part paid" : ""}
      </span>
    );
  }
  return null;
}

function rowLabel(entry: RentLedgerEntry): string {
  return `${entry.tenantName}, ${formatBillingMonth(entry.obligation.billingMonth)}`;
}

export function RentLedgerTableRow({ entry, onRecordPayment, onViewHistory }: RentLedgerRowProps) {
  const { formatDate } = useFormatters();
  const { obligation, tenancy } = entry;
  return (
    <TableRow>
      <TableCell className="pl-4 font-medium">
        <TenantLink entry={entry} />
        {tenancy.status === "Ended" && (
          <span className="block text-xs font-normal text-muted-foreground">Tenancy ended</span>
        )}
      </TableCell>
      <TableCell>
        <span className="block">{entry.property?.name ?? "Unknown property"}</span>
        <span className="block text-xs text-muted-foreground">
          Unit {entry.unit?.unitNumber ?? "unknown"}
        </span>
      </TableCell>
      <TableCell>{formatBillingMonth(obligation.billingMonth)}</TableCell>
      <TableCell>{formatDate(obligation.dueDate)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatINR(obligation.expectedAmount)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatINR(entry.amountPaid)}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatINR(entry.balance)}
      </TableCell>
      <TableCell>
        <PaymentStatusBadge status={entry.status} />
        <StatusDetail entry={entry} />
      </TableCell>
      <TableCell className="pr-4">
        <div className="flex justify-end gap-1">
          {entry.balance > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRecordPayment(entry)}
              aria-label={`Record payment for ${rowLabel(entry)}`}
            >
              Record
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onViewHistory(entry)}
            aria-label={`Payment history for ${entry.tenantName} at ${entry.location}`}
            title="Payment history"
          >
            <History />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Compact ledger entry used in place of the table on smaller screens. */
export function RentLedgerCard({ entry, onRecordPayment, onViewHistory }: RentLedgerRowProps) {
  const { formatDate } = useFormatters();
  const { obligation, tenancy } = entry;
  return (
    <article className="space-y-3 rounded-xl border bg-card p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium break-words">
            <TenantLink entry={entry} />
          </h3>
          <p className="text-xs text-muted-foreground">
            {formatBillingMonth(obligation.billingMonth)} · due {formatDate(obligation.dueDate)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <PaymentStatusBadge status={entry.status} />
          <StatusDetail entry={entry} />
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-muted-foreground">
        <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {entry.location}
          {tenancy.status === "Ended" && " · tenancy ended"}
        </span>
      </p>

      <dl className="grid grid-cols-3 gap-3 border-t pt-3">
        <div>
          <dt className="text-xs text-muted-foreground">Expected</dt>
          <dd className="font-medium tabular-nums">{formatINR(obligation.expectedAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Paid</dt>
          <dd className="font-medium tabular-nums">{formatINR(entry.amountPaid)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Balance</dt>
          <dd className="font-medium tabular-nums">{formatINR(entry.balance)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {entry.balance > 0 && (
          <Button
            size="sm"
            onClick={() => onRecordPayment(entry)}
            aria-label={`Record payment for ${rowLabel(entry)}`}
          >
            <Plus data-icon="inline-start" />
            Record payment
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewHistory(entry)}
          aria-label={`Payment history for ${entry.tenantName} at ${entry.location}`}
        >
          <History data-icon="inline-start" />
          History
        </Button>
      </div>
    </article>
  );
}
