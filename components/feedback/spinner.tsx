import { cn } from "cn";
import { LoaderCircle } from "lucide-react";

/** A spinning icon. Place inside a button (it sizes itself) or next to loading text. */
export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      data-icon="inline-start"
      className={cn("animate-spin", className)}
      aria-hidden
    />
  );
}

/** A centred loading message for content that is still being prepared. */
export function LoadingState({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Spinner className="size-4" />
      {label}
    </p>
  );
}
