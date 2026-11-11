import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatINR } from "@/lib/format";
import type { RentCollectionSummary } from "@/types/dashboard";

type RentCollectionCardProps = {
  rent: RentCollectionSummary;
};

export function RentCollectionCard({ rent }: RentCollectionCardProps) {
  const roundedPercent = Math.round(rent.collectedPercent);

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>Rent collection</CardTitle>
        <CardDescription>{rent.periodLabel}</CardDescription>
        <CardAction className="text-sm font-medium tabular-nums">
          {roundedPercent}% collected
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatINR(rent.collected)}
            </span>
            <span className="text-sm text-muted-foreground">
              of {formatINR(rent.expected)} expected
            </span>
          </p>
          <Progress
            value={rent.collectedPercent}
            aria-label={`${roundedPercent}% of expected rent collected`}
            className="[&_[data-slot=progress-track]]:h-2"
          />
        </div>

        <dl className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
          <Stat label="Expected" value={formatINR(rent.expected)} />
          <Stat label="Collected" value={formatINR(rent.collected)} />
          <Stat
            label="Outstanding"
            value={formatINR(rent.outstanding)}
            detail={`${formatINR(rent.overdue)} overdue · ${formatINR(rent.notYetDue)} not yet due`}
          />
        </dl>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        {rent.tenantsPaidInFull} of {rent.tenantsBilled} tenants have paid in
        full this month
      </CardFooter>
    </Card>
  );
}

type StatProps = {
  label: string;
  value: string;
  detail?: string;
};

function Stat({ label, value, detail }: StatProps) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
      {detail && <dd className="text-xs text-muted-foreground">{detail}</dd>}
    </div>
  );
}
