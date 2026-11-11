"use client";

import { useMemo, useRef, useState } from "react";

import { SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { focusFirstInvalid, FormField } from "@/components/form-field";
import { usePortfolio } from "@/components/portfolio-provider";
import { RupeeInput } from "@/components/rupee-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/format";
import {
  getEarliestPaymentDate,
  validatePaymentForm,
  type PaymentFormValues,
} from "@/lib/payment-validation";
import {
  buildRentLedger,
  formatBillingMonth,
  getOpenObligations,
  PAYMENT_METHODS,
} from "@/lib/rent-calculations";
import type { FieldErrors } from "@/lib/validation";
import type { Payment, PaymentMethod } from "@/types/payment";
import type { RentLedgerEntry } from "@/types/rent-obligation";

type RecordPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes whenever the dialog is reopened, so the form starts fresh. */
  formKey: number;
  /** Preselects a tenancy and, optionally, one of its obligations. */
  tenancyId?: string;
  obligationId?: string;
  onRecorded: (payment: Payment) => void;
};

export function RecordPaymentDialog({
  open,
  onOpenChange,
  formKey,
  tenancyId,
  obligationId,
  onRecorded,
}: RecordPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Record rent you&apos;ve received. A part payment leaves the rest of the month&apos;s
            rent outstanding. All fields are required unless marked optional.
          </DialogDescription>
        </DialogHeader>
        <RecordPaymentForm
          key={formKey}
          initialTenancyId={tenancyId}
          initialObligationId={obligationId}
          onRecorded={(payment) => {
            onOpenChange(false);
            onRecorded(payment);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

type RecordPaymentFormProps = {
  initialTenancyId?: string;
  initialObligationId?: string;
  onRecorded: (payment: Payment) => void;
};

function RecordPaymentForm({
  initialTenancyId,
  initialObligationId,
  onRecorded,
}: RecordPaymentFormProps) {
  const { today, tenancies, tenants, units, properties, payments, obligations, recordPayment } =
    usePortfolio();
  const formRef = useRef<HTMLFormElement>(null);
  const ledger = useMemo(
    () => buildRentLedger({ tenancies, tenants, units, properties, payments, obligations }, today),
    [tenancies, tenants, units, properties, payments, obligations, today],
  );

  const [values, setValues] = useState<PaymentFormValues>(() => {
    const tenancyId = initialTenancyId ?? "";
    const open = tenancyId ? getOpenObligations(ledger, tenancyId) : [];
    const entry =
      open.find((candidate) => candidate.obligation.id === initialObligationId) ?? open[0];
    return {
      tenancyId,
      obligationId: entry?.obligation.id ?? "",
      amount: entry ? String(entry.balance) : "",
      paymentDate: today,
      paymentMethod: "",
      transactionReference: "",
      notes: "",
    };
  });
  const [errors, setErrors] = useState<FieldErrors<PaymentFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const lock = useSubmitLock();

  const context = { tenancies, ledger, today };
  const tenancyOptions = useMemo(() => {
    const tenantName = (tenantId: string) =>
      tenants.find((tenant) => tenant.id === tenantId)?.fullName ?? "Unknown tenant";
    const locationOf = (unitId: string) => {
      const unit = units.find((candidate) => candidate.id === unitId);
      const property = properties.find((candidate) => candidate.id === unit?.propertyId);
      return `${property?.name ?? "Unknown property"}, ${unit?.unitNumber ?? "unknown unit"}`;
    };
    const options = tenancies
      .map((tenancy) => {
        const open = getOpenObligations(ledger, tenancy.id);
        return {
          tenancy,
          label: `${tenantName(tenancy.tenantId)} · ${locationOf(tenancy.unitId)}`,
          due: open.reduce((total, entry) => total + entry.balance, 0),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    return {
      active: options.filter((option) => option.tenancy.status === "Active"),
      endedWithDue: options.filter(
        (option) => option.tenancy.status === "Ended" && option.due > 0,
      ),
    };
  }, [tenancies, tenants, units, properties, ledger]);

  const openObligations = values.tenancyId ? getOpenObligations(ledger, values.tenancyId) : [];
  const selectedEntry = openObligations.find(
    (entry) => entry.obligation.id === values.obligationId,
  );
  const selectedTenancy = tenancies.find((tenancy) => tenancy.id === values.tenancyId);
  const tenancyEntry = ledger.find((entry) => entry.tenancy.id === values.tenancyId);
  const selectedUnit = units.find((unit) => unit.id === selectedTenancy?.unitId);
  const selectedProperty = properties.find((property) => property.id === selectedUnit?.propertyId);

  function update(next: PaymentFormValues) {
    setValues(next);
    if (submitted) {
      const result = validatePaymentForm(next, context);
      setErrors(result.success ? {} : result.errors);
    }
  }

  function selectTenancy(tenancyId: string) {
    const first = getOpenObligations(ledger, tenancyId)[0];
    update({
      ...values,
      tenancyId,
      obligationId: first?.obligation.id ?? "",
      amount: first ? String(first.balance) : "",
    });
  }

  function selectObligation(obligationId: string) {
    const entry = openObligations.find((candidate) => candidate.obligation.id === obligationId);
    update({ ...values, obligationId, amount: entry ? String(entry.balance) : values.amount });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const result = validatePaymentForm(values, context);
    if (!result.success) {
      setErrors(result.errors);
      focusFirstInvalid(formRef.current);
      return;
    }
    if (!lock.acquire()) return;
    const saved = await recordPayment(result.data);
    if (!saved.ok) {
      lock.release();
      setErrors({ amount: saved.error });
      focusFirstInvalid(formRef.current);
      return;
    }
    onRecorded(saved.value);
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-5">
      <FormField id="payment-tenancy" label="Tenant" error={errors.tenancyId}>
        {(control) => (
          <NativeSelect
            {...control}
            value={values.tenancyId}
            onChange={(event) => selectTenancy(event.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="" disabled>
              Select a tenant
            </NativeSelectOption>
            <NativeSelectOptGroup label="Active tenancies">
              {tenancyOptions.active.map(({ tenancy, label, due }) => (
                <NativeSelectOption key={tenancy.id} value={tenancy.id} disabled={due === 0}>
                  {due === 0 ? `${label} · nothing due` : label}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
            {tenancyOptions.endedWithDue.length > 0 && (
              <NativeSelectOptGroup label="Ended tenancies with rent due">
                {tenancyOptions.endedWithDue.map(({ tenancy, label }) => (
                  <NativeSelectOption key={tenancy.id} value={tenancy.id}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            )}
          </NativeSelect>
        )}
      </FormField>

      {selectedTenancy && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-4">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <dt className="text-xs text-muted-foreground">Property</dt>
            <dd className="font-medium break-words">{selectedProperty?.name ?? "Unknown"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Unit</dt>
            <dd className="font-medium">{selectedUnit?.unitNumber ?? "Unknown"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Monthly rent</dt>
            <dd className="font-medium tabular-nums">
              {formatINR(selectedTenancy.monthlyRent)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tenancy</dt>
            <dd className="font-medium">{selectedTenancy.status}</dd>
          </div>
        </dl>
      )}

      <FormField
        id="payment-obligation"
        label="Rent for"
        description={
          !values.tenancyId
            ? "Select a tenant first."
            : openObligations.length === 0
              ? tenancyEntry
                ? "All billed rent for this tenancy has been paid."
                : "No rent has been billed to this tenancy yet."
              : "Months with an outstanding balance, oldest first."
        }
        error={errors.obligationId}
      >
        {(control) => (
          <NativeSelect
            {...control}
            value={values.obligationId}
            onChange={(event) => selectObligation(event.target.value)}
            disabled={openObligations.length === 0}
            className="w-full"
          >
            <NativeSelectOption value="" disabled>
              Select a billing month
            </NativeSelectOption>
            {openObligations.map((entry) => (
              <NativeSelectOption key={entry.obligation.id} value={entry.obligation.id}>
                {obligationLabel(entry)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          id="payment-amount"
          label="Amount received"
          description={
            selectedEntry
              ? `${formatINR(selectedEntry.balance)} outstanding. Enter less for a part payment.`
              : undefined
          }
          error={errors.amount}
        >
          {(control) => (
            <RupeeInput
              {...control}
              value={values.amount}
              onChange={(amount) => update({ ...values, amount })}
              placeholder="e.g. 32,000"
            />
          )}
        </FormField>

        <FormField id="payment-date" label="Payment date" error={errors.paymentDate}>
          {(control) => (
            <Input
              {...control}
              type="date"
              value={values.paymentDate}
              min={selectedTenancy ? getEarliestPaymentDate(selectedTenancy) : undefined}
              max={today}
              onChange={(event) => update({ ...values, paymentDate: event.target.value })}
            />
          )}
        </FormField>

        <FormField id="payment-method" label="Payment method" error={errors.paymentMethod}>
          {(control) => (
            <NativeSelect
              {...control}
              value={values.paymentMethod}
              onChange={(event) =>
                update({ ...values, paymentMethod: event.target.value as PaymentMethod })
              }
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Select a method
              </NativeSelectOption>
              {PAYMENT_METHODS.map((method) => (
                <NativeSelectOption key={method} value={method}>
                  {method}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField
          id="payment-reference"
          label="Transaction reference"
          optional
          description="UTR, UPI reference, cheque or receipt number."
          error={errors.transactionReference}
        >
          {(control) => (
            <Input
              {...control}
              value={values.transactionReference}
              onChange={(event) =>
                update({ ...values, transactionReference: event.target.value })
              }
            />
          )}
        </FormField>
      </div>

      <FormField id="payment-notes" label="Notes" optional error={errors.notes}>
        {(control) => (
          <Textarea
            {...control}
            value={values.notes}
            rows={2}
            onChange={(event) => update({ ...values, notes: event.target.value })}
          />
        )}
      </FormField>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={lock.pending} />}>
          Cancel
        </DialogClose>
        <SubmitButton pending={lock.pending} pendingLabel="Recording…">
          Record payment
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

function obligationLabel(entry: RentLedgerEntry): string {
  const month = formatBillingMonth(entry.obligation.billingMonth);
  const paid = entry.amountPaid > 0 ? ` (${formatINR(entry.amountPaid)} paid)` : "";
  const overdue = entry.status === "Overdue" ? " · overdue" : "";
  return `${month} · ${formatINR(entry.balance)} due${paid}${overdue}`;
}
