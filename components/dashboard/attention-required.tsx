import Link from "next/link";
import { CalendarClock, CircleAlert, Siren, Wrench, type LucideIcon } from "lucide-react";

import {
  MaintenancePriorityBadge,
  MaintenanceStatusBadge,
} from "@/components/maintenance/maintenance-badges";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFormatters } from "@/components/settings/settings-provider";
import { toCalendarDate } from "@/lib/dates";
import { formatINR, pluralize } from "@/lib/format";
import type {
  ExpiringAgreement,
  MaintenanceAlert,
  MaintenanceAlerts,
  OverdueRent,
} from "@/types/dashboard";

type AttentionRequiredProps = {
  overdueRent: OverdueRent[];
  maintenance: MaintenanceAlerts;
  expiringAgreements: ExpiringAgreement[];
  asOf: string;
};

export function AttentionRequired({
  overdueRent,
  maintenance,
  expiringAgreements,
  asOf,
}: AttentionRequiredProps) {
  const today = toCalendarDate(asOf);
  const { formatDate } = useFormatters();
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>Needs attention</CardTitle>
        <CardDescription>Items that need follow-up from you</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <AttentionGroup
          title="Overdue rent this month"
          icon={CircleAlert}
          count={overdueRent.length}
          emptyMessage="No rent overdue this month."
          viewAll={{ href: "/payments", label: "Open Rent & Payments" }}
        >
          {overdueRent.map((item) => (
            <AttentionRow
              key={item.tenancyId}
              primary={item.tenantName}
              href={`/tenants/${item.tenantId}`}
              secondary={item.location}
              meta={<span className="tabular-nums">{formatINR(item.balance)}</span>}
              status={
                <Badge variant="destructive">
                  {pluralize(item.daysOverdue, "day")} overdue
                </Badge>
              }
            />
          ))}
        </AttentionGroup>

        <AttentionGroup
          title="Urgent maintenance"
          icon={Siren}
          count={maintenance.urgent.length}
          emptyMessage="No urgent maintenance requests."
          viewAll={{ href: "/maintenance", label: "Open Maintenance" }}
        >
          {maintenance.urgent.map((item) => (
            <MaintenanceAlertRow key={item.id} item={item} today={today} formatDate={formatDate} />
          ))}
        </AttentionGroup>

        <AttentionGroup
          title="Overdue high-priority maintenance"
          icon={Wrench}
          count={maintenance.overdueHighPriority.length}
          emptyMessage="No high-priority requests past their target date."
        >
          {maintenance.overdueHighPriority.map((item) => (
            <MaintenanceAlertRow key={item.id} item={item} today={today} formatDate={formatDate} />
          ))}
        </AttentionGroup>

        <AttentionGroup
          title="Agreements ending soon"
          icon={CalendarClock}
          count={expiringAgreements.length}
          emptyMessage="No agreements ending in the next 60 days."
        >
          {expiringAgreements.map((item) => (
            <AttentionRow
              key={item.tenancyId}
              primary={item.tenantName}
              href={`/tenants/${item.tenantId}`}
              secondary={item.location}
              meta={`Ends ${formatDate(item.endDate)}`}
              status={
                <Badge variant="outline">
                  in {pluralize(item.daysRemaining, "day")}
                </Badge>
              }
            />
          ))}
        </AttentionGroup>
      </CardContent>
    </Card>
  );
}

type AttentionGroupProps = {
  title: string;
  icon: LucideIcon;
  count: number;
  emptyMessage: string;
  viewAll?: { href: string; label: string };
  children: React.ReactNode;
};

function AttentionGroup({
  title,
  icon: Icon,
  count,
  emptyMessage,
  viewAll,
  children,
}: AttentionGroupProps) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
        </h3>
        {viewAll && count > 0 && (
          <Link
            href={viewAll.href}
            className="rounded-sm text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {viewAll.label}
          </Link>
        )}
      </div>
      {count === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border/60">{children}</ul>
      )}
    </section>
  );
}

type MaintenanceAlertRowProps = {
  item: MaintenanceAlert;
  today: string;
  formatDate: (calendarDate: string) => string;
};

function MaintenanceAlertRow({ item, today, formatDate }: MaintenanceAlertRowProps) {
  const target = !item.targetResolutionDate
    ? `Reported ${formatDate(item.reportedAt)}`
    : item.targetResolutionDate === today
      ? "Due today"
      : `Due ${formatDate(item.targetResolutionDate)}`;
  return (
    <AttentionRow
      primary={item.title}
      href={`/maintenance/${item.id}`}
      secondary={`${item.location} · ${target}`}
      meta={<MaintenanceStatusBadge status={item.status} />}
      status={
        item.daysOverdue > 0 ? (
          <Badge variant="destructive">{pluralize(item.daysOverdue, "day")} overdue</Badge>
        ) : (
          <MaintenancePriorityBadge priority={item.priority} />
        )
      }
    />
  );
}

type AttentionRowProps = {
  primary: string;
  href?: string;
  secondary: string;
  meta: React.ReactNode;
  status: React.ReactNode;
};

function AttentionRow({ primary, href, secondary, meta, status }: AttentionRowProps) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium">
          {href ? (
            <Link
              href={href}
              className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {primary}
            </Link>
          ) : (
            primary
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{secondary}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
        {meta}
        {status}
      </div>
    </li>
  );
}
