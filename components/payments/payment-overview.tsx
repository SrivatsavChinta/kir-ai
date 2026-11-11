import { CircleAlert, Clock, HandCoins, ReceiptIndianRupee, UsersRound, Wallet } from "lucide-react";

import { MetricCard } from "@/components/metric-card";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatINR, pluralize } from "@/lib/format";
import { formatBillingMonth } from "@/lib/rent-calculations";
import type { RentMonthSummary } from "@/types/rent-obligation";

type PaymentOverviewProps = {
  summary: RentMonthSummary;
  /** Unpaid balances from months before the selected one. */
  earlierArrears: { amount: number; tenancyCount: number };
};

export function PaymentOverview({ summary, earlierArrears }: PaymentOverviewProps) {
  const month = formatBillingMonth(summary.billingMonth);

  return (
    <div className="space-y-4">
      <section
        aria-label={`Rent totals for ${month}`}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <MetricCard
          label="Expected rent"
          value={formatINR(summary.expected)}
          description={`Billed to ${pluralize(summary.obligationCount, "tenancy", "tenancies")}`}
          icon={Wallet}
        />
        <MetricCard
          label="Rent collected"
          value={formatINR(summary.collected)}
          description={`${Math.round(summary.collectedPercent)}% of expected rent`}
          icon={HandCoins}
        />
        <MetricCard
          label="Outstanding rent"
          value={formatINR(summary.outstanding)}
          description={`${formatINR(summary.notYetDue)} not yet due`}
          icon={Clock}
        />
        <MetricCard
          label="Overdue rent"
          value={formatINR(summary.overdue)}
          description={summary.overdue > 0 ? "Past its due date" : "Nothing overdue"}
          icon={CircleAlert}
        />
        <MetricCard
          label="Payments received"
          value={String(summary.paymentCount)}
          description={`Towards ${month} rent`}
          icon={ReceiptIndianRupee}
        />
        <MetricCard
          label="Tenancies with a balance"
          value={String(summary.tenanciesWithBalance)}
          description={`${summary.paidInFullCount} of ${summary.obligationCount} paid in full`}
          icon={UsersRound}
        />
      </section>

      <CollectionProgress summary={summary} month={month} />

      {earlierArrears.amount > 0 && (
        <p
          role="note"
          className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formatINR(earlierArrears.amount)} is still unpaid from months before {month}, across{" "}
          {pluralize(earlierArrears.tenancyCount, "tenancy", "tenancies")}. It isn&apos;t
          included in the figures above.
        </p>
      )}
    </div>
  );
}

function CollectionProgress({ summary, month }: { summary: RentMonthSummary; month: string }) {
  const share = (amount: number) => (summary.expected === 0 ? 0 : (amount / summary.expected) * 100);
  const segments = [
    { label: "Collected", amount: summary.collected, className: "bg-emerald-500" },
    { label: "Overdue", amount: summary.overdue, className: "bg-destructive" },
    { label: "Not yet due", amount: summary.notYetDue, className: "bg-muted-foreground/30" },
  ];
  const roundedPercent = Math.round(summary.collectedPercent);

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Rent collection
        </CardTitle>
        <CardDescription>{month}</CardDescription>
        <CardAction className="text-sm font-medium tabular-nums">
          {roundedPercent}% collected
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatINR(summary.collected)}
          </span>
          <span className="text-sm text-muted-foreground">
            of {formatINR(summary.expected)} expected
          </span>
        </p>
        <div
          role="img"
          aria-label={`${roundedPercent}% collected: ${segments
            .map((segment) => `${segment.label.toLowerCase()} ${formatINR(segment.amount)}`)
            .join(", ")}`}
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
        >
          {segments.map((segment) =>
            segment.amount > 0 ? (
              <div
                key={segment.label}
                className={segment.className}
                style={{ width: `${share(segment.amount)}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-hidden>
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${segment.className}`} />
              {segment.label}
              <span className="font-medium text-foreground tabular-nums">
                {formatINR(segment.amount)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
