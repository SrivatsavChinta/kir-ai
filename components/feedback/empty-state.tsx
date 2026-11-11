import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Buttons or links, e.g. "Clear filters" or "Add property". */
  action?: React.ReactNode;
  /** Use "h1" when the empty state replaces a whole page, e.g. a record that wasn't found. */
  titleAs?: "p" | "h1" | "h2";
  className?: string;
};

/** A dashed panel for lists with nothing to show, or pages with no record. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  titleAs: Title = "p",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-6 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <Title className="font-medium">{title}</Title>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** A compact empty message inside a card, e.g. "No documents yet." */
export function InlineEmptyState({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
      <Icon className="size-5 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
