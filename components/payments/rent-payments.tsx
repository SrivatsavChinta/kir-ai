"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { usePaymentConfirmation } from "@/components/payments/payment-confirmation";
import { PaymentHistorySheet } from "@/components/payments/payment-history";
import { PaymentOverview } from "@/components/payments/payment-overview";
import { RecordPaymentDialog } from "@/components/payments/record-payment-form";
import { RentLedger } from "@/components/payments/rent-ledger";
import { usePortfolio } from "@/components/portfolio-provider";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  buildRentLedger,
  formatBillingMonth,
  getBillingMonths,
  getEarlierArrears,
  summarizeRentMonth,
} from "@/lib/rent-calculations";

type DialogState = { open: boolean; key: number; tenancyId?: string; obligationId?: string };

export function RentPayments() {
  const { today, tenancies, tenants, units, properties, payments, obligations } = usePortfolio();
  const ledger = useMemo(
    () => buildRentLedger({ tenancies, tenants, units, properties, payments, obligations }, today),
    [tenancies, tenants, units, properties, payments, obligations, today],
  );
  const months = getBillingMonths(today);
  const currentMonth = months[0];

  const [month, setMonth] = useState(currentMonth);
  const [ledgerMonth, setLedgerMonth] = useState(currentMonth);
  const [dialog, setDialog] = useState<DialogState>({ open: false, key: 0 });
  const [history, setHistory] = useState<{ open: boolean; tenancyId?: string }>({
    open: false,
  });
  const { confirmPayment, clearNotice } = usePaymentConfirmation();

  const summary = summarizeRentMonth(ledger, month);
  const earlierArrears = getEarlierArrears(ledger, month);

  function selectMonth(next: string) {
    setMonth(next);
    setLedgerMonth(next);
  }

  function openRecordPayment(tenancyId?: string, obligationId?: string) {
    clearNotice();
    setHistory((state) => ({ ...state, open: false }));
    setDialog((state) => ({ open: true, key: state.key + 1, tenancyId, obligationId }));
  }

  function openHistory(tenancyId: string) {
    setHistory({ open: true, tenancyId });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent & Payments"
        description="Track the rent each tenancy owes, record payments and follow up on overdue balances."
        actions={
          <>
            <NativeSelect
              value={month}
              onChange={(event) => selectMonth(event.target.value)}
              aria-label="Billing month"
              className="w-full sm:w-56"
            >
              {months.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {formatBillingMonth(option)}
                  {option === currentMonth ? " (current)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button size="lg" onClick={() => openRecordPayment()}>
              <Plus data-icon="inline-start" />
              Record payment
            </Button>
          </>
        }
      />

      <PaymentOverview summary={summary} earlierArrears={earlierArrears} />

      <RentLedger
        entries={ledger}
        properties={properties}
        months={months}
        month={ledgerMonth}
        onMonthChange={setLedgerMonth}
        defaultMonth={month}
        onRecordPayment={(entry) => openRecordPayment(entry.tenancy.id, entry.obligation.id)}
        onViewHistory={(entry) => openHistory(entry.tenancy.id)}
      />

      <RecordPaymentDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        formKey={dialog.key}
        tenancyId={dialog.tenancyId}
        obligationId={dialog.obligationId}
        onRecorded={(payment) => confirmPayment(payment, openHistory)}
      />

      <PaymentHistorySheet
        open={history.open}
        onOpenChange={(open) => setHistory((state) => ({ ...state, open }))}
        tenancyId={history.tenancyId}
        onRecordPayment={(tenancyId) => openRecordPayment(tenancyId)}
      />
    </div>
  );
}
