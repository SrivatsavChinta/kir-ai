"use client";

import { useState } from "react";
import Link from "next/link";
import { DoorOpen, Pencil, Plus } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useNotice } from "@/components/feedback/notice";
import { UnitFormDialog } from "@/components/properties/unit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, pluralize } from "@/lib/format";
import { formatFloor } from "@/lib/properties";
import type { Property, RentalUnit } from "@/types/property";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";

type UnitListProps = {
  property: Property;
  units: RentalUnit[];
  tenants: Tenant[];
  tenancies: Tenancy[];
};

type DialogState = {
  open: boolean;
  unit: RentalUnit | null;
  key: number;
};

export function UnitList({ property, units, tenants, tenancies }: UnitListProps) {
  const [dialog, setDialog] = useState<DialogState>({ open: false, unit: null, key: 0 });
  const { showNotice, clearNotice } = useNotice();
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const currentTenantByUnitId = new Map<string, Tenant>();
  for (const tenancy of tenancies) {
    const tenant = tenantById.get(tenancy.tenantId);
    if (tenancy.status === "Active" && tenant) currentTenantByUnitId.set(tenancy.unitId, tenant);
  }

  function openDialog(unit: RentalUnit | null) {
    clearNotice();
    setDialog((current) => ({ open: true, unit, key: current.key + 1 }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Rental units
        </CardTitle>
        <CardDescription>
          {units.length > 0
            ? pluralize(units.length, "unit")
            : "No units added yet"}
        </CardDescription>
        <CardAction>
          <Button onClick={() => openDialog(null)}>
            <Plus data-icon="inline-start" />
            Add unit
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className={units.length > 0 ? "px-0" : undefined}>
        {units.length === 0 ? (
          <EmptyState
            icon={DoorOpen}
            title="No units yet"
            description="Add the flats, houses or villas you rent out in this property."
            className="rounded-lg py-10"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Unit</TableHead>
                <TableHead className="hidden sm:table-cell">Floor</TableHead>
                <TableHead className="hidden sm:table-cell">Bedrooms</TableHead>
                <TableHead className="text-right">Monthly rent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Current tenant</TableHead>
                <TableHead className="pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => {
                const tenant = currentTenantByUnitId.get(unit.id);
                const tenantLabel =
                  unit.status === "Vacant" ? null : (tenant?.fullName ?? "Tenant not recorded");

                return (
                  <TableRow key={unit.id}>
                    <TableCell className="pl-4">
                      <span className="font-medium">{unit.unitNumber}</span>
                      {tenantLabel && (
                        <span className="block text-xs text-muted-foreground sm:hidden">
                          {tenantLabel}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatFloor(unit.floor)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {unit.bedrooms ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(unit.monthlyRent)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={unit.status === "Occupied" ? "secondary" : "outline"}>
                        {unit.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {unit.status === "Vacant" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : tenant ? (
                        <Link
                          href={`/tenants/${tenant.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {tenant.fullName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Not recorded</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openDialog(unit)}
                        aria-label={`Edit unit ${unit.unitNumber}`}
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <UnitFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        propertyId={property.id}
        propertyName={property.name}
        siblingUnits={units}
        unit={dialog.unit}
        activeTenantName={
          dialog.unit ? currentTenantByUnitId.get(dialog.unit.id)?.fullName : undefined
        }
        formKey={dialog.key}
        onSaved={(unitNumber) =>
          showNotice({
            tone: "success",
            title: dialog.unit ? "Unit updated" : "Unit added",
            message: dialog.unit
              ? `Changes to unit ${unitNumber} have been saved.`
              : `Unit ${unitNumber} has been added to ${property.name}.`,
          })
        }
      />
    </Card>
  );
}
