"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DoorClosed, DoorOpen, Building2, KeyRound, Plus, Search, SearchX } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { usePortfolio } from "@/components/portfolio-provider";
import { PropertyCard } from "@/components/properties/property-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatINR, pluralize } from "@/lib/format";
import {
  formatOccupancy,
  getUnitsForProperty,
  PROPERTY_TYPES,
  summarizeUnits,
} from "@/lib/properties";
import type { PropertyType, UnitSummary } from "@/types/property";

type OccupancyFilter = "all" | "fully-occupied" | "has-vacancies" | "no-units";

const occupancyFilterOptions: { value: OccupancyFilter; label: string }[] = [
  { value: "all", label: "All occupancy" },
  { value: "fully-occupied", label: "Fully occupied" },
  { value: "has-vacancies", label: "Has vacancies" },
  { value: "no-units", label: "No units yet" },
];

function matchesOccupancy(summary: UnitSummary, filter: OccupancyFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "fully-occupied":
      return summary.totalUnits > 0 && summary.vacantUnits === 0;
    case "has-vacancies":
      return summary.vacantUnits > 0;
    case "no-units":
      return summary.totalUnits === 0;
  }
}

export function PropertyList() {
  const { properties, units } = usePortfolio();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PropertyType | "all">("all");
  const [occupancyFilter, setOccupancyFilter] = useState<OccupancyFilter>("all");

  const rows = useMemo(
    () =>
      properties.map((property) => ({
        property,
        summary: summarizeUnits(getUnitsForProperty(units, property.id)),
      })),
    [properties, units],
  );

  const portfolio = useMemo(() => {
    const propertyIds = new Set(properties.map((property) => property.id));
    return summarizeUnits(units.filter((unit) => propertyIds.has(unit.propertyId)));
  }, [properties, units]);

  const cityCount = new Set(properties.map((property) => property.city.toLowerCase())).size;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter(({ property, summary }) => {
    const searchable = [
      property.name,
      property.address,
      property.city,
      property.state,
      property.pincode,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (typeFilter === "all" || property.propertyType === typeFilter) &&
      matchesOccupancy(summary, occupancyFilter)
    );
  });

  const filtersActive =
    normalizedQuery !== "" || typeFilter !== "all" || occupancyFilter !== "all";

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setOccupancyFilter("all");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Manage your rental properties and the units within them."
        actions={
          <Link href="/properties/new" className={buttonVariants({ size: "lg" })}>
            <Plus data-icon="inline-start" />
            Add property
          </Link>
        }
      />

      <section
        aria-label="Portfolio totals"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Total properties"
          value={String(properties.length)}
          description={
            properties.length > 0 ? `In ${pluralize(cityCount, "city", "cities")}` : undefined
          }
          icon={Building2}
        />
        <MetricCard
          label="Total rental units"
          value={String(portfolio.totalUnits)}
          description={`${formatINR(portfolio.potentialMonthlyRent)} potential monthly rent`}
          icon={DoorOpen}
        />
        <MetricCard
          label="Occupied units"
          value={String(portfolio.occupiedUnits)}
          description={`${formatOccupancy(portfolio.occupancyPercent)} occupancy`}
          icon={KeyRound}
        />
        <MetricCard
          label="Vacant units"
          value={String(portfolio.vacantUnits)}
          description={
            portfolio.vacantUnits > 0
              ? `${formatINR(portfolio.vacantMonthlyRent)} monthly rent available`
              : "All units are let"
          }
          icon={DoorClosed}
        />
      </section>

      <section aria-label="Property list" className="space-y-4">
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
              placeholder="Search by name or location"
              aria-label="Search properties by name or location"
              className="pl-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <NativeSelect
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as PropertyType | "all")
              }
              aria-label="Filter by property type"
              className="w-full md:w-48"
            >
              <NativeSelectOption value="all">All property types</NativeSelectOption>
              {PROPERTY_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              value={occupancyFilter}
              onChange={(event) =>
                setOccupancyFilter(event.target.value as OccupancyFilter)
              }
              aria-label="Filter by occupancy"
              className="w-full md:w-44"
            >
              {occupancyFilterOptions.map((option) => (
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
            ? `Showing ${filteredRows.length} of ${pluralize(properties.length, "property", "properties")}`
            : pluralize(properties.length, "property", "properties")}
        </p>

        {filteredRows.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredRows.map(({ property, summary }) => (
              <li key={property.id} className="flex *:flex-1">
                <PropertyCard property={property} summary={summary} />
              </li>
            ))}
          </ul>
        ) : (
          <ListEmptyState
            filtered={properties.length > 0}
            onClearFilters={clearFilters}
          />
        )}
      </section>
    </div>
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
      title="No properties match your filters"
      description="Try a different search term or clear the filters."
      action={
        <Button variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Building2}
      title="No properties yet"
      description="Add your first property to start tracking its units."
      action={
        <Link href="/properties/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          Add property
        </Link>
      }
    />
  );
}
