"use client";

import Link from "next/link";
import { DoorClosed, DoorOpen, KeyRound, MapPin, Pencil, Wallet } from "lucide-react";

import { RelatedDocuments } from "@/components/documents/related-documents";
import { RelatedMaintenance } from "@/components/maintenance/related-maintenance";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { usePortfolio } from "@/components/portfolio-provider";
import { PropertyNotFound } from "@/components/properties/property-not-found";
import { UnitList } from "@/components/properties/unit-list";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import {
  formatAddress,
  formatOccupancy,
  getUnitsForProperty,
  summarizeUnits,
} from "@/lib/properties";

export function PropertyDetail({ propertyId }: { propertyId: string }) {
  const { properties, units, tenants, tenancies } = usePortfolio();
  const property = properties.find((candidate) => candidate.id === propertyId);

  if (!property) return <PropertyNotFound />;

  const propertyUnits = getUnitsForProperty(units, property.id);
  const summary = summarizeUnits(propertyUnits);

  return (
    <div className="space-y-6">
      <PageHeader
        title={property.name}
        back={{ href: "/properties", label: "Properties" }}
        description={
          <p className="flex items-start gap-1.5 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            {formatAddress(property)}
          </p>
        }
        actions={
          <Link
            href={`/properties/${property.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Pencil data-icon="inline-start" />
            Edit property
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary">{property.propertyType}</Badge>
        </div>
        {property.description && (
          <p className="max-w-2xl pt-1 text-sm">{property.description}</p>
        )}
      </PageHeader>

      <section
        aria-label="Property summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Total rental units"
          value={String(summary.totalUnits)}
          icon={DoorOpen}
        />
        <MetricCard
          label="Occupied units"
          value={String(summary.occupiedUnits)}
          description={
            summary.totalUnits > 0
              ? `${formatOccupancy(summary.occupancyPercent)} occupancy`
              : undefined
          }
          icon={KeyRound}
        />
        <MetricCard
          label="Vacant units"
          value={String(summary.vacantUnits)}
          description={
            summary.vacantUnits > 0
              ? `${formatINR(summary.vacantMonthlyRent)} monthly rent available`
              : undefined
          }
          icon={DoorClosed}
        />
        <MetricCard
          label="Potential monthly rent"
          value={formatINR(summary.potentialMonthlyRent)}
          description={
            summary.totalUnits > 0
              ? `${formatINR(summary.occupiedMonthlyRent)} from occupied units`
              : undefined
          }
          icon={Wallet}
        />
      </section>

      <UnitList
        property={property}
        units={propertyUnits}
        tenants={tenants}
        tenancies={tenancies}
      />

      <RelatedMaintenance owner={{ type: "property", id: property.id }} wide />

      <RelatedDocuments owner={{ type: "property", id: property.id }} wide />
    </div>
  );
}
