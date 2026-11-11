"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";

import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { focusFirstInvalid, FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { usePortfolio } from "@/components/portfolio-provider";
import { RupeeInput } from "@/components/rupee-input";
import { useFormatters } from "@/components/settings/settings-provider";
import { TenantNotFound } from "@/components/tenants/tenant-not-found";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatINR } from "@/lib/format";
import { getUnitsForProperty } from "@/lib/properties";
import {
  getUnitAvailability,
  tenancyToFormValues,
  validateTenancyForm,
  type TenancyFormValues,
} from "@/lib/tenant-validation";
import { findTenant, getCurrentTenancy, getLatestTenancy } from "@/lib/tenants";
import type { FieldErrors } from "@/lib/validation";
import type { Tenancy } from "@/types/tenancy";

type TenancyFieldsProps = {
  values: TenancyFormValues;
  errors: FieldErrors<TenancyFormValues>;
  onChange: (values: TenancyFormValues) => void;
  /** The active tenancy being edited, if any. */
  currentTenancy?: Tenancy;
};

/** Property, unit, rent and agreement fields for starting or editing a tenancy. */
export function TenancyFields({ values, errors, onChange, currentTenancy }: TenancyFieldsProps) {
  const { properties, units, tenants, tenancies } = usePortfolio();
  const propertyUnits = values.propertyId ? getUnitsForProperty(units, values.propertyId) : [];
  const unitOptions = propertyUnits.map((unit) => ({
    unit,
    availability: getUnitAvailability(unit, { tenancies, tenants, currentTenancy }),
  }));
  const availableCount = unitOptions.filter((option) => option.availability.available).length;
  const selectedUnit = units.find((unit) => unit.id === values.unitId);
  const currentUnit = currentTenancy
    ? units.find((unit) => unit.id === currentTenancy.unitId)
    : undefined;
  const isMove = currentTenancy !== undefined && values.unitId !== "" && values.unitId !== currentTenancy.unitId;

  function update(field: keyof TenancyFormValues, value: string) {
    onChange({ ...values, [field]: value });
  }

  function selectProperty(propertyId: string) {
    onChange({ ...values, propertyId, unitId: "" });
  }

  function selectUnit(unitId: string) {
    const unit = units.find((candidate) => candidate.id === unitId);
    if (currentTenancy && unitId === currentTenancy.unitId) {
      // Back to the current unit: restore the tenancy's own terms.
      onChange({ ...tenancyToFormValues(currentTenancy, unit), propertyId: values.propertyId });
      return;
    }
    onChange({
      ...values,
      unitId,
      monthlyRent: unit ? String(unit.monthlyRent) : values.monthlyRent,
      securityDeposit: unit?.securityDeposit !== undefined ? String(unit.securityDeposit) : "",
      moveInDate: currentTenancy ? "" : values.moveInDate,
    });
  }

  let unitDescription = "Only vacant units can be assigned.";
  if (!values.propertyId) unitDescription = "Select a property first.";
  else if (propertyUnits.length === 0) unitDescription = "This property has no units yet.";
  else if (availableCount === 0) {
    unitDescription = "No vacant units in this property. Units with a tenant can't be assigned.";
  }

  const rentDescription =
    selectedUnit && !(currentTenancy && selectedUnit.id === currentTenancy.unitId)
      ? `Prefilled from the unit's listed rent of ${formatINR(selectedUnit.monthlyRent)}. Change it if you agreed a different amount.`
      : "The rent agreed with the tenant.";

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <FormField id="tenancy-property" label="Property" error={errors.propertyId}>
        {(control) => (
          <NativeSelect
            {...control}
            value={values.propertyId}
            onChange={(event) => selectProperty(event.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="" disabled>
              Select a property
            </NativeSelectOption>
            {properties.map((property) => (
              <NativeSelectOption key={property.id} value={property.id}>
                {property.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <FormField
        id="tenancy-unit"
        label="Rental unit"
        description={unitDescription}
        error={errors.unitId}
      >
        {(control) => (
          <NativeSelect
            {...control}
            value={values.unitId}
            onChange={(event) => selectUnit(event.target.value)}
            disabled={!values.propertyId}
            className="w-full"
          >
            <NativeSelectOption value="" disabled>
              Select a unit
            </NativeSelectOption>
            {unitOptions.map(({ unit, availability }) => (
              <NativeSelectOption key={unit.id} value={unit.id} disabled={!availability.available}>
                {availability.available
                  ? unit.id === currentTenancy?.unitId
                    ? `${unit.unitNumber} (current unit)`
                    : `${unit.unitNumber} · Vacant · ${formatINR(unit.monthlyRent)}`
                  : `${unit.unitNumber} · ${availability.reason === "let" ? `Let to ${availability.tenantName}` : "Marked occupied"}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>

      {isMove && currentUnit && selectedUnit && (
        <div
          role="status"
          className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
        >
          <ArrowRightLeft className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            This records a move from unit {currentUnit.unitNumber} to unit{" "}
            {selectedUnit.unitNumber}. The current tenancy will end on the move-in
            date below and stay in the tenant&apos;s history. A new tenancy starts
            for unit {selectedUnit.unitNumber}, and unit {currentUnit.unitNumber}{" "}
            becomes vacant.
          </p>
        </div>
      )}

      <FormField
        id="tenancy-rent"
        label="Monthly rent"
        description={rentDescription}
        error={errors.monthlyRent}
      >
        {(control) => (
          <RupeeInput
            {...control}
            value={values.monthlyRent}
            onChange={(value) => update("monthlyRent", value)}
            placeholder="e.g. 32,000"
          />
        )}
      </FormField>

      <FormField
        id="tenancy-deposit"
        label="Security deposit"
        description="Enter 0 if no deposit was taken."
        error={errors.securityDeposit}
      >
        {(control) => (
          <RupeeInput
            {...control}
            value={values.securityDeposit}
            onChange={(value) => update("securityDeposit", value)}
            placeholder="e.g. 1,60,000"
          />
        )}
      </FormField>

      <FormField
        id="tenancy-due-day"
        label="Rent due day"
        description="Day of the month rent is due, from 1 to 28."
        error={errors.rentDueDay}
      >
        {(control) => (
          <Input
            {...control}
            value={values.rentDueDay}
            onChange={(event) => update("rentDueDay", event.target.value)}
            inputMode="numeric"
            maxLength={2}
          />
        )}
      </FormField>

      <FormField
        id="tenancy-move-in"
        label={isMove ? "Move date" : "Move-in date"}
        description={
          isMove
            ? "The day the tenant moved into the new unit."
            : "Can be earlier than the agreement start if the agreement was renewed."
        }
        error={errors.moveInDate}
      >
        {(control) => (
          <Input
            {...control}
            type="date"
            value={values.moveInDate}
            onChange={(event) => update("moveInDate", event.target.value)}
          />
        )}
      </FormField>

      <FormField
        id="tenancy-agreement-start"
        label="Agreement start date"
        error={errors.agreementStartDate}
      >
        {(control) => (
          <Input
            {...control}
            type="date"
            value={values.agreementStartDate}
            onChange={(event) => update("agreementStartDate", event.target.value)}
          />
        )}
      </FormField>

      <FormField
        id="tenancy-agreement-end"
        label="Agreement end date"
        error={errors.agreementEndDate}
      >
        {(control) => (
          <Input
            {...control}
            type="date"
            value={values.agreementEndDate}
            onChange={(event) => update("agreementEndDate", event.target.value)}
          />
        )}
      </FormField>
    </div>
  );
}

/**
 * Edits the tenant's active tenancy, or starts a new one for a former tenant.
 * Ended tenancies are history and can't be edited here.
 */
export function TenancyFormPage({ tenantId }: { tenantId: string }) {
  const { tenants, tenancies, units } = usePortfolio();
  const tenant = findTenant(tenants, tenantId);
  if (!tenant) return <TenantNotFound />;

  const current = getCurrentTenancy(tenancies, tenant.id);
  const latest = getLatestTenancy(tenancies, tenant.id);
  const latestUnit = latest ? units.find((unit) => unit.id === latest.unitId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={current ? "Edit tenancy" : "Start a new tenancy"}
        description={tenant.fullName}
        back={{ href: `/tenants/${tenant.id}`, label: tenant.fullName }}
      />
      <TenancyForm
        key={current?.id ?? "new"}
        tenantId={tenant.id}
        tenantName={tenant.fullName}
        tenancy={current}
        previousPropertyId={latestUnit?.propertyId}
      />
    </div>
  );
}

type TenancyFormProps = {
  tenantId: string;
  tenantName: string;
  tenancy?: Tenancy;
  previousPropertyId?: string;
};

function TenancyForm({ tenantId, tenantName, tenancy, previousPropertyId }: TenancyFormProps) {
  const router = useRouter();
  const { today, units, tenants, tenancies, updateTenancy, startTenancy } = usePortfolio();
  const { formatDate } = useFormatters();
  const lock = useSubmitLock();
  const [formError, setFormError] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<TenancyFormValues>(() => {
    if (tenancy) {
      return tenancyToFormValues(tenancy, units.find((unit) => unit.id === tenancy.unitId));
    }
    return { ...tenancyToFormValues(), propertyId: previousPropertyId ?? "" };
  });
  const [errors, setErrors] = useState<FieldErrors<TenancyFormValues>>({});
  const [submitted, setSubmitted] = useState(false);

  const context = { units, tenants, tenancies, today, currentTenancy: tenancy };
  const profileHref = `/tenants/${tenantId}`;

  function handleChange(next: TenancyFormValues) {
    setValues(next);
    setFormError(undefined);
    if (submitted) {
      const result = validateTenancyForm(next, context);
      setErrors(result.success ? {} : result.errors);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    const result = validateTenancyForm(values, context);
    if (!result.success) {
      setErrors(result.errors);
      focusFirstInvalid(formRef.current);
      return;
    }

    if (!lock.acquire()) return;
    const saved = tenancy
      ? await updateTenancy(tenancy.id, result.data)
      : await startTenancy(tenantId, result.data);
    if (!saved.ok) {
      lock.release();
      if (saved.field === "unitId") {
        setErrors({ unitId: saved.error });
        focusFirstInvalid(formRef.current);
      } else {
        setFormError(saved.error);
      }
      return;
    }
    router.push(profileHref);
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Tenancy details
          </CardTitle>
          <CardDescription>
            {tenancy
              ? `Correct the terms of ${tenantName}'s current tenancy, or choose a different unit to record a move. Started ${formatDate(tenancy.moveInDate)}.`
              : `${tenantName} has no active tenancy. Their earlier tenancies stay in their history.`}{" "}
            All fields are required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <TenancyFields
            values={values}
            errors={errors}
            onChange={handleChange}
            currentTenancy={tenancy}
          />
          <FormError message={formError} />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Link href={profileHref} className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton pending={lock.pending} pendingLabel="Saving…">
            {tenancy ? "Save tenancy" : "Start tenancy"}
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
