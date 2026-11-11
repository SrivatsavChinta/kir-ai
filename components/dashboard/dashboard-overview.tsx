"use client";

import { useMemo, useState } from "react";
import { Clock, DoorOpen, HandCoins, KeyRound } from "lucide-react";

import { AttentionRequired } from "@/components/dashboard/attention-required";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { RentCollectionCard } from "@/components/dashboard/rent-collection-card";
import { useDocuments } from "@/components/documents/documents-provider";
import { useMaintenance } from "@/components/maintenance/maintenance-provider";
import { MetricCard } from "@/components/metric-card";
import { usePaymentConfirmation } from "@/components/payments/payment-confirmation";
import { RecordPaymentDialog } from "@/components/payments/record-payment-form";
import { usePortfolio } from "@/components/portfolio-provider";
import { useFormatters, useSettings } from "@/components/settings/settings-provider";
import { getDashboardOverview } from "@/lib/dashboard";
import { formatINR, pluralize } from "@/lib/format";
import { getFirstName } from "@/lib/settings";

export function DashboardOverview() {
  const { asOf, properties, units, tenants, tenancies, payments, obligations } = usePortfolio();
  const { requests: maintenanceRequests } = useMaintenance();
  const { rows: documentRows } = useDocuments();
  const { settings } = useSettings();
  const { formatDateTime } = useFormatters();
  const { confirmPayment, clearNotice } = usePaymentConfirmation();
  const [paymentDialog, setPaymentDialog] = useState({ open: false, key: 0 });
  const documents = useMemo(() => documentRows.map((row) => row.document), [documentRows]);
  const overview = useMemo(
    () =>
      getDashboardOverview({
        asOf,
        properties,
        units,
        tenants,
        tenancies,
        payments,
        obligations,
        maintenanceRequests,
        documents,
      }),
    [asOf, properties, units, tenants, tenancies, payments, obligations, maintenanceRequests, documents],
  );
  const { portfolio, rent } = overview;

  const rentCard = <RentCollectionCard rent={rent} />;
  const attentionCard = (
    <AttentionRequired
      overdueRent={overview.overdueRent}
      maintenance={overview.maintenance}
      expiringAgreements={overview.expiringAgreements}
      asOf={overview.asOf}
    />
  );
  const attentionFirst = settings.application.dashboardView === "attention-first";

  return (
    <div className="space-y-6">
      <DashboardGreeting
        firstName={getFirstName(settings.profile.fullName)}
        portfolioName={settings.portfolio.portfolioName}
        dataNotice={`Portfolio as of ${formatDateTime(overview.asOf)}`}
        onRecordPayment={() => {
          clearNotice();
          setPaymentDialog((state) => ({ open: true, key: state.key + 1 }));
        }}
      />

      <section
        aria-label="Portfolio summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Total rental units"
          value={String(portfolio.totalUnits)}
          description={`Across ${pluralize(portfolio.propertyCount, "property", "properties")}`}
          icon={DoorOpen}
        />
        <MetricCard
          label="Occupied units"
          value={String(portfolio.occupiedUnits)}
          description={`${Math.round(portfolio.occupancyPercent)}% occupancy · ${portfolio.vacantUnits} vacant`}
          icon={KeyRound}
        />
        <MetricCard
          label="Rent collected this month"
          value={formatINR(rent.collected)}
          description={`${Math.round(rent.collectedPercent)}% of ${formatINR(rent.expected)} expected`}
          icon={HandCoins}
        />
        <MetricCard
          label="Outstanding rent this month"
          value={formatINR(rent.outstanding)}
          description={
            rent.overdue > 0
              ? `${formatINR(rent.overdue)} overdue from ${pluralize(overview.overdueRent.length, "tenant")}`
              : "Nothing overdue"
          }
          icon={Clock}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <div className="space-y-6 xl:col-span-2">
          {attentionFirst ? attentionCard : rentCard}
          {attentionFirst ? rentCard : attentionCard}
        </div>
        <RecentActivity items={overview.activity} asOf={overview.asOf} />
      </div>

      <RecordPaymentDialog
        open={paymentDialog.open}
        onOpenChange={(open) => setPaymentDialog((state) => ({ ...state, open }))}
        formKey={paymentDialog.key}
        onRecorded={(payment) => confirmPayment(payment)}
      />
    </div>
  );
}
