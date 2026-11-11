import Link from "next/link";
import { cn } from "cn";

import {
  MaintenancePriorityBadge,
  MaintenanceStatusBadge,
} from "@/components/maintenance/maintenance-badges";
import { useFormatters } from "@/components/settings/settings-provider";
import { TableCell, TableRow } from "@/components/ui/table";
import { pluralize } from "@/lib/format";
import { getDaysOverdue, type MaintenanceRow } from "@/lib/maintenance";

type ItemProps = { row: MaintenanceRow; today: string };

function TargetDate({ row, today }: ItemProps) {
  const { formatDate } = useFormatters();
  const { targetResolutionDate } = row.request;
  if (!targetResolutionDate) return <span className="text-muted-foreground">Not set</span>;
  const overdue = getDaysOverdue(row.request, today);
  return (
    <span className={cn(overdue > 0 && "font-medium text-destructive")}>
      {formatDate(targetResolutionDate)}
      {overdue > 0 && <span className="block text-xs">{pluralize(overdue, "day")} overdue</span>}
    </span>
  );
}

function RequestLink({ row, className }: { row: MaintenanceRow; className?: string }) {
  return (
    <Link
      href={`/maintenance/${row.request.id}`}
      className={cn(
        "rounded-sm font-medium break-words underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {row.request.title}
    </Link>
  );
}

export function MaintenanceRequestCard({ row, today }: ItemProps) {
  const { formatDate } = useFormatters();
  const { request, property, unit, tenant } = row;
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
      <div className="space-y-1.5">
        <h3>
          <RequestLink row={row} />
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <MaintenanceStatusBadge status={request.status} />
          <MaintenancePriorityBadge priority={request.priority} />
          <span className="text-xs text-muted-foreground">{request.category}</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="col-span-2 min-w-0">
          <dt className="text-xs text-muted-foreground">Location</dt>
          <dd className="break-words">
            {property?.name ?? "Unknown property"}
            {" · "}
            {request.unitId ? (unit?.unitNumber ?? "Unknown unit") : "Whole property"}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-xs text-muted-foreground">Tenant</dt>
          <dd className="break-words">
            {tenant?.fullName ?? <span className="text-muted-foreground">None</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reported</dt>
          <dd>{formatDate(request.reportedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Target</dt>
          <dd>
            <TargetDate row={row} today={today} />
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function MaintenanceRequestTableRow({ row, today }: ItemProps) {
  const { formatDate } = useFormatters();
  const { request, property, unit, tenant } = row;
  return (
    <TableRow>
      <TableCell className="max-w-64 pl-4 whitespace-normal">
        <RequestLink row={row} className="block" />
        <span className="text-xs text-muted-foreground">{request.category}</span>
      </TableCell>
      <TableCell className="max-w-48 whitespace-normal">
        <span className="block">{property?.name ?? "Unknown property"}</span>
        <span className="text-xs text-muted-foreground">
          {request.unitId ? `Unit ${unit?.unitNumber ?? "unknown"}` : "Whole property"}
        </span>
      </TableCell>
      <TableCell className="max-w-36 whitespace-normal">
        {tenant?.fullName ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        <MaintenancePriorityBadge priority={request.priority} />
      </TableCell>
      <TableCell>
        <MaintenanceStatusBadge status={request.status} />
      </TableCell>
      <TableCell>{formatDate(request.reportedAt)}</TableCell>
      <TableCell className="pr-4">
        <TargetDate row={row} today={today} />
      </TableCell>
    </TableRow>
  );
}
