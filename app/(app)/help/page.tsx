import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Help & Support" };

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Help & Support" />
      <EmptyState
        icon={LifeBuoy}
        titleAs="h2"
        title="Help articles aren't available yet"
        description="This prototype doesn't include guides or a support contact."
      />
    </div>
  );
}
