import Link from "next/link";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { buttonVariants } from "@/components/ui/button";

export function PropertyNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      titleAs="h1"
      title="Property not found"
      description="This property doesn't exist in your portfolio."
      action={
        <Link href="/properties" className={buttonVariants({ variant: "outline" })}>
          Back to properties
        </Link>
      }
      className="py-16"
    />
  );
}
