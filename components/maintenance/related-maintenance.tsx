"use client";

import Link from "next/link";
import { cn } from "cn";
import { Plus, Wrench } from "lucide-react";

import { InlineEmptyState } from "@/components/feedback/empty-state";
import { MaintenanceRequestCard } from "@/components/maintenance/maintenance-list-item";
import { useMaintenanceRows } from "@/components/maintenance/use-maintenance-rows";
import { useRequestDialog } from "@/components/maintenance/use-request-dialog";
import { usePortfolio } from "@/components/portfolio-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pluralize } from "@/lib/format";
import { compareForProfile, isUnresolved } from "@/lib/maintenance";

type RelatedMaintenanceProps = {
  /** A property's requests include those for its units. */
  owner: { type: "property" | "tenant"; id: string };
  /** Lay cards out in two columns on wider screens. */
  wide?: boolean;
};

/** A profile's maintenance requests, with new requests linked to the profile. */
export function RelatedMaintenance({ owner, wide = false }: RelatedMaintenanceProps) {
  const { today } = usePortfolio();
  const rows = useMaintenanceRows();
  const { openCreate, dialogs } = useRequestDialog();
  const related = rows
    .filter(({ request }) =>
      owner.type === "property" ? request.propertyId === owner.id : request.tenantId === owner.id,
    )
    .sort((a, b) => compareForProfile(a.request, b.request));
  const unresolved = related.filter(({ request }) => isUnresolved(request.status)).length;
  const query = owner.type === "property" ? { propertyId: owner.id } : { tenantId: owner.id };

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Maintenance
        </CardTitle>
        <CardDescription>
          {owner.type === "property"
            ? "Requests for this property and its units"
            : "Requests reported by or linked to this tenant"}
        </CardDescription>
        <CardAction>
          <Button variant="outline" onClick={() => openCreate(query)}>
            <Plus data-icon="inline-start" />
            New request
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {related.length === 0 ? (
          <InlineEmptyState icon={Wrench}>
            No maintenance requests yet.{" "}
            {owner.type === "property"
              ? "Log repairs for the building or any of its units."
              : "Log an issue this tenant reports."}
          </InlineEmptyState>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {pluralize(related.length, "request")} · {unresolved} unresolved
            </p>
            <ul className={cn("grid grid-cols-1 gap-3", wide && "md:grid-cols-2")}>
              {related.map((row) => (
                <li key={row.request.id}>
                  <MaintenanceRequestCard row={row} today={today} />
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/maintenance" className={buttonVariants({ variant: "link", className: "px-0" })}>
          Open Maintenance
        </Link>
      </CardContent>
      {dialogs}
    </Card>
  );
}
