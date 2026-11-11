"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Plus, Search, SearchX, UserCheck, UserMinus, Users } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { usePortfolio } from "@/components/portfolio-provider";
import { TenantCard } from "@/components/tenants/tenant-card";
import { TenantStatusBadge } from "@/components/tenants/tenant-status-badge";
import { useFormatters } from "@/components/settings/settings-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatPhone, pluralize } from "@/lib/format";
import {
  AGREEMENT_EXPIRY_WINDOW_DAYS,
  getTenantRows,
  type TenantRow,
} from "@/lib/tenants";

type StatusFilter = "all" | "active" | "ending-soon" | "former";

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "ending-soon", label: "Agreement ending soon" },
  { value: "former", label: "Former tenants" },
];

function matchesStatus(row: TenantRow, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return row.status === "Active";
    case "ending-soon":
      return row.agreement?.kind === "ending-soon";
    case "former":
      return row.status === "Former";
  }
}

function matchesQuery(row: TenantRow, query: string): boolean {
  if (!query) return true;
  const { fullName, email, phone } = row.tenant;
  if (fullName.toLowerCase().includes(query) || email.toLowerCase().includes(query)) {
    return true;
  }
  // Match phone numbers regardless of spacing or a +91 prefix.
  const queryDigits = query.replace(/\D/g, "");
  return queryDigits.length >= 3 && phone.replace(/\D/g, "").includes(queryDigits);
}

export function TenantList() {
  const { today, tenants, tenancies, units, properties } = usePortfolio();
  const [query, setQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const rows = useMemo(
    () => getTenantRows({ tenants, tenancies, units, properties }, today),
    [tenants, tenancies, units, properties, today],
  );

  const activeCount = rows.filter((row) => row.status === "Active").length;
  const endingSoonCount = rows.filter((row) => row.agreement?.kind === "ending-soon").length;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter(
    (row) =>
      matchesQuery(row, normalizedQuery) &&
      (propertyFilter === "all" || row.property?.id === propertyFilter) &&
      matchesStatus(row, statusFilter),
  );

  const filtersActive =
    normalizedQuery !== "" || propertyFilter !== "all" || statusFilter !== "all";

  function clearFilters() {
    setQuery("");
    setPropertyFilter("all");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Keep contact details, tenancies and agreement dates for everyone renting from you."
        actions={
          <Link href="/tenants/new" className={buttonVariants({ size: "lg" })}>
            <Plus data-icon="inline-start" />
            Add tenant
          </Link>
        }
      />

      <section
        aria-label="Tenant totals"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Total tenants"
          value={String(rows.length)}
          description="Current and former"
          icon={Users}
        />
        <MetricCard
          label="Active tenants"
          value={String(activeCount)}
          description="With an active tenancy"
          icon={UserCheck}
        />
        <MetricCard
          label="Inactive tenants"
          value={String(rows.length - activeCount)}
          description="Former tenants with no active tenancy"
          icon={UserMinus}
        />
        <MetricCard
          label="Agreements ending soon"
          value={String(endingSoonCount)}
          description={`Within the next ${AGREEMENT_EXPIRY_WINDOW_DAYS} days`}
          icon={CalendarClock}
        />
      </section>

      <section aria-label="Tenant list" className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div role="search" className="relative md:max-w-xs md:flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, phone or email"
              aria-label="Search tenants by name, phone or email"
              className="pl-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <NativeSelect
              value={propertyFilter}
              onChange={(event) => setPropertyFilter(event.target.value)}
              aria-label="Filter by property"
              className="w-full md:w-48"
            >
              <NativeSelectOption value="all">All properties</NativeSelectOption>
              {properties.map((property) => (
                <NativeSelectOption key={property.id} value={property.id}>
                  {property.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              aria-label="Filter by tenancy status"
              className="w-full md:w-52"
            >
              {statusFilterOptions.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {filtersActive && (
            <Button variant="ghost" onClick={clearFilters} className="self-start md:self-auto">
              Clear filters
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {filtersActive
            ? `Showing ${filteredRows.length} of ${pluralize(rows.length, "tenant")}`
            : pluralize(rows.length, "tenant")}
        </p>

        {filteredRows.length === 0 ? (
          <ListEmptyState filtered={rows.length > 0} onClearFilters={clearFilters} />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 md:hidden">
              {filteredRows.map((row) => (
                <li key={row.tenant.id}>
                  <TenantCard row={row} />
                </li>
              ))}
            </ul>
            <div className="hidden rounded-xl border bg-card md:block">
              <TenantTable rows={filteredRows} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function TenantTable({ rows }: { rows: TenantRow[] }) {
  const { formatDate } = useFormatters();
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">Tenant</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Property and unit</TableHead>
          <TableHead className="text-right">Monthly rent</TableHead>
          <TableHead>Move-in date</TableHead>
          <TableHead className="pr-4">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.tenant.id}>
            <TableCell className="pl-4 font-medium">
              <Link
                href={`/tenants/${row.tenant.id}`}
                className="underline-offset-4 hover:underline"
              >
                {row.tenant.fullName}
              </Link>
            </TableCell>
            <TableCell>
              <span className="block tabular-nums">{formatPhone(row.tenant.phone)}</span>
              <span className="block text-xs text-muted-foreground">{row.tenant.email}</span>
            </TableCell>
            <TableCell>
              {row.property && row.unit ? (
                <>
                  <span className="block">{row.property.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Unit {row.unit.unitNumber}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.tenancy ? formatINR(row.tenancy.monthlyRent) : "—"}
            </TableCell>
            <TableCell>{row.tenancy ? formatDate(row.tenancy.moveInDate) : "—"}</TableCell>
            <TableCell className="pr-4">
              <TenantStatusBadge status={row.status} agreement={row.agreement} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type EmptyStateProps = {
  filtered: boolean;
  onClearFilters: () => void;
};

function ListEmptyState({ filtered, onClearFilters }: EmptyStateProps) {
  return filtered ? (
    <EmptyState
      icon={SearchX}
      title="No tenants match your filters"
      description="Try a different search term or clear the filters."
      action={
        <Button variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Users}
      title="No tenants yet"
      description="Add a tenant to assign them to one of your vacant units."
      action={
        <Link href="/tenants/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          Add tenant
        </Link>
      }
    />
  );
}
