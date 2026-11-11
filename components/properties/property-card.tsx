import Link from "next/link";
import { MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatINR } from "@/lib/format";
import { formatOccupancy } from "@/lib/properties";
import type { Property, UnitSummary } from "@/types/property";

type PropertyCardProps = {
  property: Property;
  summary: UnitSummary;
};

export function PropertyCard({ property, summary }: PropertyCardProps) {
  return (
    <Card className="relative transition-shadow hover:shadow-sm hover:ring-foreground/20 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <CardHeader>
        <Badge variant="secondary" className="mb-1">
          {property.propertyType}
        </Badge>
        <CardTitle role="heading" aria-level={2} className="truncate">
          <Link
            href={`/properties/${property.id}`}
            className="outline-none after:absolute after:inset-0"
          >
            {property.name}
          </Link>
        </CardTitle>
        <CardDescription className="flex min-w-0 items-start gap-1.5">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate">{property.address}</span>
            <span className="block truncate">
              {property.city}, {property.state} {property.pincode}
            </span>
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-3 gap-3">
          <UnitStat label="Units" value={summary.totalUnits} />
          <UnitStat label="Occupied" value={summary.occupiedUnits} />
          <UnitStat label="Vacant" value={summary.vacantUnits} />
        </dl>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Occupancy</span>
            <span className="font-medium tabular-nums">
              {summary.totalUnits === 0
                ? "No units yet"
                : formatOccupancy(summary.occupancyPercent)}
            </span>
          </div>
          <Progress
            value={summary.occupancyPercent ?? 0}
            aria-label={`${property.name} occupancy`}
            className="[&_[data-slot=progress-track]]:h-1.5"
          />
        </div>
      </CardContent>

      <CardFooter className="mt-auto justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Potential monthly rent</span>
        <span className="font-semibold tabular-nums">
          {formatINR(summary.potentialMonthlyRent)}
        </span>
      </CardFooter>
    </Card>
  );
}

function UnitStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
