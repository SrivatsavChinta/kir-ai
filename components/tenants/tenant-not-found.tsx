import Link from "next/link";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { buttonVariants } from "@/components/ui/button";

export function TenantNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      titleAs="h1"
      title="Tenant not found"
      description="This tenant doesn't exist in your portfolio."
      action={
        <Link href="/tenants" className={buttonVariants({ variant: "outline" })}>
          Back to tenants
        </Link>
      }
      className="py-16"
    />
  );
}
