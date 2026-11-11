import Link from "next/link";
import { Building2, Mail, Phone } from "lucide-react";

import { TenantStatusBadge } from "@/components/tenants/tenant-status-badge";
import { useFormatters } from "@/components/settings/settings-provider";
import { formatINR, formatPhone } from "@/lib/format";
import type { TenantRow } from "@/lib/tenants";

/** Compact tenant summary used in place of the table on small screens. */
export function TenantCard({ row }: { row: TenantRow }) {
  const { formatDate } = useFormatters();
  const { tenant, tenancy, unit, property } = row;

  return (
    <article className="relative space-y-3 rounded-xl border bg-card p-4 text-sm has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-medium break-words">
          <Link
            href={`/tenants/${tenant.id}`}
            className="outline-none after:absolute after:inset-0 hover:underline"
          >
            {tenant.fullName}
          </Link>
        </h3>
        <TenantStatusBadge status={row.status} agreement={row.agreement} />
      </div>

      {property && unit && (
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {property.name}, {unit.unitNumber}
          </span>
        </p>
      )}

      <div className="space-y-1 text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Phone className="size-4 shrink-0" aria-hidden />
          <span className="tabular-nums">{formatPhone(tenant.phone)}</span>
        </p>
        <p className="flex min-w-0 items-center gap-1.5">
          <Mail className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{tenant.email}</span>
        </p>
      </div>

      {tenancy && (
        <dl className="grid grid-cols-2 gap-3 border-t pt-3">
          <div>
            <dt className="text-xs text-muted-foreground">Monthly rent</dt>
            <dd className="font-medium tabular-nums">{formatINR(tenancy.monthlyRent)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Move-in date</dt>
            <dd className="font-medium">{formatDate(tenancy.moveInDate)}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}
