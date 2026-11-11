"use client";

import { useState } from "react";
import {
  CircleCheck,
  ClipboardList,
  Hammer,
  Inbox,
  Plus,
  Search,
  SearchX,
  Siren,
  Wrench,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useMaintenance } from "@/components/maintenance/maintenance-provider";
import {
  MaintenanceRequestCard,
  MaintenanceRequestTableRow,
} from "@/components/maintenance/maintenance-list-item";
import { useMaintenanceRows } from "@/components/maintenance/use-maintenance-rows";
import { useRequestDialog } from "@/components/maintenance/use-request-dialog";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { usePortfolio } from "@/components/portfolio-provider";
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
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pluralize } from "@/lib/format";
import {
  isUnresolved,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  summarizeMaintenance,
} from "@/lib/maintenance";

const ALL = "all";
const UNRESOLVED = "unresolved";

export function MaintenanceRequests() {
  const { today, properties, tenants } = usePortfolio();
  const { requests } = useMaintenance();
  const rows = useMaintenanceRows();
  const { openCreate, dialogs } = useRequestDialog();
  const summary = summarizeMaintenance(requests);

  const [query, setQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState(ALL);
  const [tenantFilter, setTenantFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = rows.filter(({ request }) => {
    const matchesQuery =
      !normalizedQuery ||
      request.title.toLowerCase().includes(normalizedQuery) ||
      request.description.toLowerCase().includes(normalizedQuery);
    const matchesStatus =
      statusFilter === ALL ||
      (statusFilter === UNRESOLVED ? isUnresolved(request.status) : request.status === statusFilter);
    return (
      matchesQuery &&
      matchesStatus &&
      (propertyFilter === ALL || request.propertyId === propertyFilter) &&
      (tenantFilter === ALL || request.tenantId === tenantFilter) &&
      (priorityFilter === ALL || request.priority === priorityFilter) &&
      (categoryFilter === ALL || request.category === categoryFilter)
    );
  });

  const filtersActive =
    normalizedQuery !== "" ||
    [propertyFilter, tenantFilter, statusFilter, priorityFilter, categoryFilter].some(
      (filter) => filter !== ALL,
    );

  function clearFilters() {
    setQuery("");
    setPropertyFilter(ALL);
    setTenantFilter(ALL);
    setStatusFilter(ALL);
    setPriorityFilter(ALL);
    setCategoryFilter(ALL);
  }

  const sortedProperties = [...properties].sort((a, b) => a.name.localeCompare(b.name));
  const sortedTenants = [...tenants].sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Track repairs and upkeep across your properties, from report to resolution."
        actions={
          <Button size="lg" onClick={() => openCreate()}>
            <Plus data-icon="inline-start" />
            New request
          </Button>
        }
      />

      <section
        aria-label="Maintenance summary"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5"
      >
        <MetricCard
          label="Total requests"
          value={String(summary.total)}
          description={`${summary.unresolved} unresolved · ${summary.onHold} on hold`}
          icon={ClipboardList}
        />
        <MetricCard label="Open" value={String(summary.open)} description="Not started yet" icon={Inbox} />
        <MetricCard
          label="In progress"
          value={String(summary.inProgress)}
          description="Work under way"
          icon={Hammer}
        />
        <MetricCard
          label="Resolved"
          value={String(summary.resolved)}
          description={`${summary.closed} closed`}
          icon={CircleCheck}
        />
        <MetricCard
          label="Urgent / high priority"
          value={String(summary.highPriority)}
          description={`${summary.urgent} urgent, still unresolved`}
          icon={Siren}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Requests
          </CardTitle>
          <CardDescription>Most recently reported first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div role="search" className="relative sm:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title or description"
                aria-label="Search requests by title or description"
                className="pl-8"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              <NativeSelect
                value={propertyFilter}
                onChange={(event) => setPropertyFilter(event.target.value)}
                aria-label="Filter by property"
                className="w-full"
              >
                <NativeSelectOption value={ALL}>All properties</NativeSelectOption>
                {sortedProperties.map((property) => (
                  <NativeSelectOption key={property.id} value={property.id}>
                    {property.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                value={tenantFilter}
                onChange={(event) => setTenantFilter(event.target.value)}
                aria-label="Filter by tenant"
                className="w-full"
              >
                <NativeSelectOption value={ALL}>All tenants</NativeSelectOption>
                {sortedTenants.map((tenant) => (
                  <NativeSelectOption key={tenant.id} value={tenant.id}>
                    {tenant.fullName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
                className="w-full"
              >
                <NativeSelectOption value={ALL}>All statuses</NativeSelectOption>
                <NativeSelectOption value={UNRESOLVED}>Unresolved</NativeSelectOption>
                {MAINTENANCE_STATUSES.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {status}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                aria-label="Filter by priority"
                className="w-full"
              >
                <NativeSelectOption value={ALL}>All priorities</NativeSelectOption>
                {MAINTENANCE_PRIORITIES.map((priority) => (
                  <NativeSelectOption key={priority} value={priority}>
                    {priority}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter by issue category"
                className="w-full"
              >
                <NativeSelectOption value={ALL}>All categories</NativeSelectOption>
                {MAINTENANCE_CATEGORIES.map((category) => (
                  <NativeSelectOption key={category} value={category}>
                    {category}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {filtersActive
                ? `Showing ${filtered.length} of ${pluralize(rows.length, "request")}`
                : pluralize(rows.length, "request")}
            </p>
            {filtersActive && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <ListEmptyState
              filtered={rows.length > 0}
              onClearFilters={clearFilters}
              onCreate={() => openCreate()}
            />
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
                {filtered.map((row) => (
                  <li key={row.request.id}>
                    <MaintenanceRequestCard row={row} today={today} />
                  </li>
                ))}
              </ul>
              <div className="hidden rounded-xl border xl:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Request</TableHead>
                      <TableHead>Property / unit</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reported</TableHead>
                      <TableHead className="pr-4">Target</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <MaintenanceRequestTableRow key={row.request.id} row={row} today={today} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {dialogs}
    </div>
  );
}

type EmptyStateProps = {
  filtered: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
};

function ListEmptyState({ filtered, onClearFilters, onCreate }: EmptyStateProps) {
  return filtered ? (
    <EmptyState
      icon={SearchX}
      title="No requests match your filters"
      description="Try different search words or fewer filters."
      action={
        <Button variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Wrench}
      title="No maintenance requests yet"
      description="Log repairs for a property, a unit or on behalf of a tenant."
      action={
        <Button onClick={onCreate}>
          <Plus data-icon="inline-start" />
          New request
        </Button>
      }
    />
  );
}
