import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  children?: React.ReactNode;
};

export function PageHeader({
  title,
  description,
  actions,
  back,
  children,
}: PageHeaderProps) {
  return (
    <div className="space-y-3">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {title}
          </h1>
          {description && (
            <div className="text-muted-foreground">{description}</div>
          )}
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
