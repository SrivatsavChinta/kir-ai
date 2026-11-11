import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  description?: string;
  icon: LucideIcon;
};

export function MetricCard({ label, value, description, icon: Icon }: MetricCardProps) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardDescription className="font-medium">{label}</CardDescription>
        <CardAction>
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="mt-auto space-y-1">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
