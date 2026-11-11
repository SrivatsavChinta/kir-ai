"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  History,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { RelatedDocuments } from "@/components/documents/related-documents";
import { RelatedMaintenance } from "@/components/maintenance/related-maintenance";
import { PageHeader } from "@/components/page-header";
import { TenantRentHistory } from "@/components/payments/tenant-rent-history";
import { usePortfolio } from "@/components/portfolio-provider";
import { EndTenancyDialog } from "@/components/tenants/end-tenancy-dialog";
import { TenantNotFound } from "@/components/tenants/tenant-not-found";
import { TenantStatusBadge } from "@/components/tenants/tenant-status-badge";
import { useFormatters } from "@/components/settings/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatINR, formatPhone, phoneHref, pluralize } from "@/lib/format";
import {
  describeAgreement,
  findTenant,
  formatDueDay,
  getAgreementState,
  getTenancyHistory,
} from "@/lib/tenants";
import type { Property, RentalUnit } from "@/types/property";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";

type ResolvedTenancy = {
  tenancy: Tenancy;
  unit?: RentalUnit;
  property?: Property;
  location: string;
};

export function TenantDetail({ tenantId }: { tenantId: string }) {
  const { today, tenants, tenancies, units, properties } = usePortfolio();
  const tenant = findTenant(tenants, tenantId);
  if (!tenant) return <TenantNotFound />;

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const history: ResolvedTenancy[] = getTenancyHistory(tenancies, tenant.id).map(
    (tenancy) => {
      const unit = unitById.get(tenancy.unitId);
      const property = unit ? propertyById.get(unit.propertyId) : undefined;
      return {
        tenancy,
        unit,
        property,
        location: `${property?.name ?? "Unknown property"}, ${unit?.unitNumber ?? "unknown unit"}`,
      };
    },
  );
  const current = history.find((entry) => entry.tenancy.status === "Active");
  const agreement = current ? getAgreementState(current.tenancy, today) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenant.fullName}
        back={{ href: "/tenants", label: "Tenants" }}
        description={
          current
            ? `Tenant at ${current.location}`
            : history[0]
              ? `Former tenant at ${history[0].location}`
              : "No tenancies recorded"
        }
        actions={
          <Link
            href={`/tenants/${tenant.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Pencil data-icon="inline-start" />
            Edit details
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <TenantStatusBadge status={current ? "Active" : "Former"} agreement={agreement} />
          {agreement && agreement.kind !== "current" && (
            <span className="text-sm text-muted-foreground">{describeAgreement(agreement)}</span>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <CurrentTenancyCard
            tenant={tenant}
            current={current}
            previous={current ? undefined : history[0]}
            today={today}
          />
          <TenancyHistoryCard history={history} />
          <TenantRentHistory tenantId={tenant.id} />
        </div>
        <div className="space-y-6">
          <PersonalDetailsCard tenant={tenant} />
          <RelatedDocuments owner={{ type: "tenant", id: tenant.id }} />
          <RelatedMaintenance owner={{ type: "tenant", id: tenant.id }} />
        </div>
      </div>
    </div>
  );
}

type CurrentTenancyCardProps = {
  tenant: Tenant;
  current?: ResolvedTenancy;
  previous?: ResolvedTenancy;
  today: string;
};

function CurrentTenancyCard({ tenant, current, previous, today }: CurrentTenancyCardProps) {
  const { formatDate } = useFormatters();
  const [dialog, setDialog] = useState({ open: false, key: 0 });
  const tenancyHref = `/tenants/${tenant.id}/tenancy`;

  if (!current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Current tenancy
          </CardTitle>
          <CardDescription>No active tenancy</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {previous?.tenancy.moveOutDate
            ? `${tenant.fullName} moved out of ${previous.location} on ${formatDate(previous.tenancy.moveOutDate)}.`
            : `${tenant.fullName} isn't renting a unit at the moment.`}
        </CardContent>
        <CardFooter>
          <Link href={tenancyHref} className={buttonVariants({ variant: "outline" })}>
            <Plus data-icon="inline-start" />
            Start a new tenancy
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const { tenancy, unit, property, location } = current;
  const agreement = getAgreementState(tenancy, today);
  const upcoming = tenancy.moveInDate > today;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Current tenancy
        </CardTitle>
        <CardDescription>{location}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <DetailItem label="Property">
            {property ? (
              <Link
                href={`/properties/${property.id}`}
                className="underline-offset-4 hover:underline"
              >
                {property.name}
              </Link>
            ) : (
              "Unknown property"
            )}
          </DetailItem>
          <DetailItem label="Rental unit">{unit?.unitNumber ?? "Unknown unit"}</DetailItem>
          <DetailItem label="Tenancy status">
            <TenantStatusBadge status="Active" agreement={agreement} />
          </DetailItem>
          <DetailItem
            label="Monthly rent"
            note={
              unit && unit.monthlyRent !== tenancy.monthlyRent
                ? `Unit listed at ${formatINR(unit.monthlyRent)}`
                : undefined
            }
          >
            {formatINR(tenancy.monthlyRent)}
          </DetailItem>
          <DetailItem label="Security deposit">{formatINR(tenancy.securityDeposit)}</DetailItem>
          <DetailItem label="Rent due">{formatDueDay(tenancy.rentDueDay)}</DetailItem>
          <DetailItem label="Move-in date" note={upcoming ? "Not moved in yet" : undefined}>
            {formatDate(tenancy.moveInDate)}
          </DetailItem>
          <DetailItem label="Agreement start">{formatDate(tenancy.agreementStartDate)}</DetailItem>
          <DetailItem label="Agreement end" note={describeAgreement(agreement)}>
            {formatDate(tenancy.agreementEndDate)}
          </DetailItem>
        </dl>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Link href={tenancyHref} className={buttonVariants({ variant: "outline" })}>
          <Pencil data-icon="inline-start" />
          Edit tenancy
        </Link>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setDialog((state) => ({ open: true, key: state.key + 1 }))}
        >
          End tenancy
        </Button>
      </CardFooter>

      <EndTenancyDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        formKey={dialog.key}
        tenancy={tenancy}
        tenantName={tenant.fullName}
        location={location}
      />
    </Card>
  );
}

function TenancyHistoryCard({ history }: { history: ResolvedTenancy[] }) {
  const { formatDate } = useFormatters();
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Tenancy history
        </CardTitle>
        <CardDescription>
          {history.length > 0
            ? `${pluralize(history.length, "tenancy", "tenancies")}, most recent first`
            : "No tenancies recorded"}
        </CardDescription>
      </CardHeader>
      {history.length > 0 && (
        <CardContent>
          <ol className="divide-y">
            {history.map(({ tenancy, property, location }) => (
              <li
                key={tenancy.id}
                className="flex flex-col gap-2 py-3 text-sm first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">
                      {property ? (
                        <Link
                          href={`/properties/${property.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {location}
                        </Link>
                      ) : (
                        location
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDate(tenancy.moveInDate)} –{" "}
                      {tenancy.moveOutDate ? formatDate(tenancy.moveOutDate) : "present"} ·{" "}
                      {formatINR(tenancy.monthlyRent)}/month
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Agreement {formatDate(tenancy.agreementStartDate)} –{" "}
                      {formatDate(tenancy.agreementEndDate)}
                    </p>
                  </div>
                </div>
                <div className="pl-7 sm:pl-0">
                  {tenancy.status === "Active" ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Ended · {tenancy.endReason ?? "Moved out"}</Badge>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

function PersonalDetailsCard({ tenant }: { tenant: Tenant }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Personal details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-4 text-sm">
          <DetailItem label="Phone" icon={Phone}>
            <a href={phoneHref(tenant.phone)} className="tabular-nums underline-offset-4 hover:underline">
              {formatPhone(tenant.phone)}
            </a>
          </DetailItem>
          <DetailItem label="Email" icon={Mail}>
            <a href={`mailto:${tenant.email}`} className="break-all underline-offset-4 hover:underline">
              {tenant.email}
            </a>
          </DetailItem>
          <DetailItem label="Current address" icon={MapPin}>
            {tenant.currentAddress ?? <span className="text-muted-foreground">Not recorded</span>}
          </DetailItem>
          <DetailItem label="Emergency contact" icon={UserRound}>
            {tenant.emergencyContact ? (
              <>
                <span className="block">{tenant.emergencyContact.name}</span>
                <a
                  href={phoneHref(tenant.emergencyContact.phone)}
                  className="text-muted-foreground tabular-nums underline-offset-4 hover:underline"
                >
                  {formatPhone(tenant.emergencyContact.phone)}
                </a>
              </>
            ) : (
              <span className="text-muted-foreground">Not recorded</span>
            )}
          </DetailItem>
        </dl>
      </CardContent>
    </Card>
  );
}

type DetailItemProps = {
  label: string;
  icon?: LucideIcon;
  note?: string;
  children: React.ReactNode;
};

function DetailItem({ label, icon: Icon, note, children }: DetailItemProps) {
  const indent = Icon ? "pl-6" : undefined;
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
        {label}
      </dt>
      <dd className={cn("font-medium", indent)}>{children}</dd>
      {note && <dd className={cn("text-xs text-muted-foreground", indent)}>{note}</dd>}
    </div>
  );
}