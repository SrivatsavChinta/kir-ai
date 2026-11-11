import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import type { MaintenancePriority, MaintenanceStatus } from "@/types/maintenance";

const STATUS_STYLES: Record<MaintenanceStatus, string> = {
  Open: "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-300",
  "In Progress": "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300",
  "On Hold": "bg-violet-100 text-violet-900 dark:bg-violet-400/15 dark:text-violet-300",
  Resolved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-300",
  Closed: "border-border bg-transparent text-muted-foreground",
};

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{status}</Badge>;
}

const PRIORITY_DOTS: Record<MaintenancePriority, string> = {
  Low: "bg-muted-foreground/50",
  Medium: "bg-sky-500",
  High: "bg-orange-500",
  Urgent: "bg-destructive",
};

export function MaintenancePriorityBadge({ priority }: { priority: MaintenancePriority }) {
  return (
    <Badge
      variant={priority === "Urgent" ? "destructive" : "outline"}
      className={cn(
        priority === "High" &&
          "border-transparent bg-orange-100 text-orange-900 dark:bg-orange-400/15 dark:text-orange-300",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", PRIORITY_DOTS[priority])} />
      {priority}
      <span className="sr-only"> priority</span>
    </Badge>
  );
}
