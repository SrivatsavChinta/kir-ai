"use client";

import { useState } from "react";
import { Search, SearchX } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import {
  RentLedgerCard,
  RentLedgerTableRow,
  type RentLedgerRowActions,
} from "@/components/payments/rent-ledger-row";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, pluralize } from "@/lib/format";
import { formatBillingMonth, RENT_STATUSES } from "@/lib/rent-calculations";
import type { Property } from "@/types/property";
import type { RentLedgerEntry, RentStatus } from "@/types/rent-obligation";

export const ALL_MONTHS = "all";

type RentLedgerProps = RentLedgerRowActions & {
  entries: RentLedgerEntry[];
  properties: Property[];
  /** Billing months available, newest first. */
  months: string[];
  /** Selected billing month, or ALL_MONTHS. */
  month: string;
  onMonthChange: (month: string) => void;
  /** The month "Clear filters" returns to. */
  defaultMonth: string;
};

export function RentLedger({
  entries,
  properties,
  months,
  month,
  onMonthChange,
  defaultMonth,
  ...actions
}: RentLedgerProps) {
  const [query, setQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<RentStatus | "all">("all");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = entries.filter(
    (entry) =>
      (month === ALL_MONTHS || entry.obligation.billingMonth === month) &&
      (!normalizedQuery || entry.tenantName.toLowerCase().includes(normalizedQuery)) &&
      (propertyFilter === "all" || entry.property?.id === propertyFilter) &&
      (statusFilter === "all" || entry.status === statusFilter),
  );
  const filteredBalance = filtered.reduce((total, entry) => total + entry.balance, 0);

  const filtersActive =
    normalizedQuery !== "" ||
    propertyFilter !== "all" ||
    statusFilter !== "all" ||
    month !== defaultMonth;

  function clearFilters() {
    setQuery("");
    setPropertyFilter("all");
    setStatusFilter("all");
    onMonthChange(defaultMonth);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Rent ledger
        </CardTitle>
        <CardDescription>
          Rent owed by each tenancy for each billing month, with payments allocated to it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <div role="search" className="relative lg:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tenant"
              aria-label="Search the ledger by tenant name"
              className="pl-8"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
            <NativeSelect
              value={propertyFilter}
              onChange={(event) => setPropertyFilter(event.target.value)}
              aria-label="Filter by property"
              className="w-full lg:w-48"
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
              onChange={(event) => setStatusFilter(event.target.value as RentStatus | "all")}
              aria-label="Filter by payment status"
              className="w-full lg:w-40"
            >
              <NativeSelectOption value="all">All statuses</NativeSelectOption>
              {RENT_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {status}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              value={month}
              onChange={(event) => onMonthChange(event.target.value)}
              aria-label="Filter by billing month"
              className="w-full lg:w-44"
            >
              <NativeSelectOption value={ALL_MONTHS}>All months</NativeSelectOption>
              {months.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {formatBillingMonth(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {filtersActive && (
            <Button variant="ghost" onClick={clearFilters} className="self-start lg:self-auto">
              Clear filters
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {`Showing ${filtered.length} of ${pluralize(entries.length, "rent entry", "rent entries")}`}
          {filtered.length > 0 && ` · ${formatINR(filteredBalance)} outstanding`}
        </p>

        {filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No rent entries match your filters"
            description="Try a different tenant name, status or month."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
              {filtered.map((entry) => (
                <li key={entry.obligation.id}>
                  <RentLedgerCard entry={entry} {...actions} />
                </li>
              ))}
            </ul>
            <div className="hidden rounded-xl border xl:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Tenant</TableHead>
                    <TableHead>Property and unit</TableHead>
                    <TableHead>Billing month</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => (
                    <RentLedgerTableRow key={entry.obligation.id} entry={entry} {...actions} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
