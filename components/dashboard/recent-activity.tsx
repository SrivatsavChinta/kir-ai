import Link from "next/link";
import {
  FileUp,
  History,
  IndianRupee,
  UserPlus,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { InlineEmptyState } from "@/components/feedback/empty-state";
import { useFormatters } from "@/components/settings/settings-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import type { ActivityItem, ActivityType } from "@/types/dashboard";

const activityIcons: Record<ActivityType, LucideIcon> = {
  payment_received: IndianRupee,
  tenant_added: UserPlus,
  maintenance_created: Wrench,
  document_uploaded: FileUp,
};

type RecentActivityProps = {
  items: ActivityItem[];
  asOf: string;
};

export function RecentActivity({ items, asOf }: RecentActivityProps) {
  const { formatDateTime, formatTimestamp } = useFormatters();
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>Recent activity</CardTitle>
        <CardDescription>
          Payments, tenants, documents and maintenance from your portfolio.
        </CardDescription>
        <CardAction>
          <Badge variant="outline">Your records</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <InlineEmptyState icon={History}>No activity yet.</InlineEmptyState>
        ) : (
          <ol className="space-y-4">
            {items.map((item) => {
              const Icon = activityIcons[item.type];
              return (
                <li key={item.id} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium break-words">
                      {item.title}
                      {item.amount !== undefined && (
                        <span className="tabular-nums"> · {formatINR(item.amount)}</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.tenantId ? (
                        <Link
                          href={`/tenants/${item.tenantId}`}
                          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {item.context}
                        </Link>
                      ) : (
                        item.context
                      )}
                    </p>
                    <time
                      dateTime={item.occurredAt}
                      title={formatDateTime(item.occurredAt)}
                      className="block text-xs text-muted-foreground"
                    >
                      {formatTimestamp(item.occurredAt, asOf)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
