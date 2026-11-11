import { Badge } from "@/components/ui/badge";
import type { AgreementState } from "@/lib/tenants";
import type { TenantStatus } from "@/types/tenant";

type TenantStatusBadgeProps = {
  status: TenantStatus;
  agreement?: AgreementState;
};

export function TenantStatusBadge({ status, agreement }: TenantStatusBadgeProps) {
  if (status === "Former") return <Badge variant="outline">Former tenant</Badge>;
  if (agreement?.kind === "expired") {
    return <Badge variant="destructive">Agreement expired</Badge>;
  }
  if (agreement?.kind === "ending-soon") {
    return (
      <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300">
        Ending soon
      </Badge>
    );
  }
  return <Badge variant="secondary">Active</Badge>;
}
