"use client";

import { useState } from "react";
import { cn } from "cn";
import { Files, Info, Plus, Search, SearchX, Upload, type LucideIcon } from "lucide-react";

import { CATEGORY_ICONS } from "@/components/documents/document-category-badge";
import { DocumentCard, DocumentTableRow } from "@/components/documents/document-list-item";
import { useDocuments } from "@/components/documents/documents-provider";
import { useDocumentActions } from "@/components/documents/use-document-actions";
import { EmptyState } from "@/components/feedback/empty-state";
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
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DOCUMENT_CATEGORIES,
  isDocumentForProperty,
  isDocumentForTenant,
} from "@/lib/documents";
import { pluralize } from "@/lib/format";
import type { DocumentCategory } from "@/types/document";

const ALL = "all";

export function DocumentManagement() {
  const { properties, tenants } = usePortfolio();
  const { rows } = useDocuments();
  const { actions, dialogs } = useDocumentActions();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | typeof ALL>(ALL);
  const [propertyFilter, setPropertyFilter] = useState(ALL);
  const [tenantFilter, setTenantFilter] = useState(ALL);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = rows.filter(
    ({ document, association }) =>
      (!normalizedQuery || document.name.toLowerCase().includes(normalizedQuery)) &&
      (categoryFilter === ALL || document.category === categoryFilter) &&
      (propertyFilter === ALL || isDocumentForProperty(association, propertyFilter)) &&
      (tenantFilter === ALL || isDocumentForTenant(association, tenantFilter)),
  );

  const filtersActive =
    normalizedQuery !== "" ||
    categoryFilter !== ALL ||
    propertyFilter !== ALL ||
    tenantFilter !== ALL;

  function clearFilters() {
    setQuery("");
    setCategoryFilter(ALL);
    setPropertyFilter(ALL);
    setTenantFilter(ALL);
  }

  const sortedTenants = [...tenants].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const sortedProperties = [...properties].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Keep agreements, ID proofs, bills and property paperwork with the records they belong to."
        actions={
          <Button size="lg" onClick={() => actions.upload()}>
            <Upload data-icon="inline-start" />
            Upload document
          </Button>
        }
      />

      <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Files are stored in a private bucket and opened with a short-lived link. They are not public.
        </span>
      </p>

      <section aria-labelledby="document-categories-heading" className="space-y-3">
        <h2 id="document-categories-heading" className="sr-only">
          Documents by category
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          <CategoryTile
            label="All documents"
            count={rows.length}
            icon={Files}
            selected={categoryFilter === ALL}
            onSelect={() => setCategoryFilter(ALL)}
          />
          {DOCUMENT_CATEGORIES.map((category) => (
            <CategoryTile
              key={category}
              label={category}
              count={rows.filter((row) => row.document.category === category).length}
              icon={CATEGORY_ICONS[category]}
              selected={categoryFilter === category}
              onSelect={() => setCategoryFilter(categoryFilter === category ? ALL : category)}
            />
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            All documents
          </CardTitle>
          <CardDescription>Most recently uploaded first.</CardDescription>
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
                placeholder="Search document name"
                aria-label="Search documents by name"
                className="pl-8"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
              <NativeSelect
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value as DocumentCategory | typeof ALL)
                }
                aria-label="Filter by category"
                className="w-full lg:w-48"
              >
                <NativeSelectOption value={ALL}>All categories</NativeSelectOption>
                {DOCUMENT_CATEGORIES.map((category) => (
                  <NativeSelectOption key={category} value={category}>
                    {category}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                value={propertyFilter}
                onChange={(event) => setPropertyFilter(event.target.value)}
                aria-label="Filter by property"
                className="w-full lg:w-48"
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
                className="w-full lg:w-44"
              >
                <NativeSelectOption value={ALL}>All tenants</NativeSelectOption>
                {sortedTenants.map((tenant) => (
                  <NativeSelectOption key={tenant.id} value={tenant.id}>
                    {tenant.fullName}
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
            {filtersActive
              ? `Showing ${filtered.length} of ${pluralize(rows.length, "document")}`
              : pluralize(rows.length, "document")}
          </p>

          {filtered.length === 0 ? (
            <ListEmptyState
              filtered={rows.length > 0}
              onClearFilters={clearFilters}
              onUpload={() => actions.upload()}
            />
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
                {filtered.map((row) => (
                  <li key={row.document.id}>
                    <DocumentCard row={row} actions={actions} />
                  </li>
                ))}
              </ul>
              <div className="hidden rounded-xl border xl:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Document</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="pr-4 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <DocumentTableRow key={row.document.id} row={row} actions={actions} />
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

type CategoryTileProps = {
  label: string;
  count: number;
  icon: LucideIcon;
  selected: boolean;
  onSelect: () => void;
};

function CategoryTile({ label, count, icon: Icon, selected, onSelect }: CategoryTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl bg-card p-3 text-left text-sm ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "bg-muted ring-2 ring-primary/60 hover:bg-muted",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{count}</span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
      </span>
      <span className="leading-snug font-medium text-muted-foreground">{label}</span>
    </button>
  );
}

type EmptyStateProps = {
  filtered: boolean;
  onClearFilters: () => void;
  onUpload: () => void;
};

function ListEmptyState({ filtered, onClearFilters, onUpload }: EmptyStateProps) {
  return filtered ? (
    <EmptyState
      icon={SearchX}
      title="No documents match your filters"
      description="Try a different name, category, property or tenant."
      action={
        <Button variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Files}
      title="No documents yet"
      description="Upload agreements, ID proofs and bills to keep them with your records."
      action={
        <Button onClick={onUpload}>
          <Plus data-icon="inline-start" />
          Upload document
        </Button>
      }
    />
  );
}
