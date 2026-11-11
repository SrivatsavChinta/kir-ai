"use client";

import { useRef, useState } from "react";

import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { UNIT_STATUSES } from "@/lib/properties";
import {
  unitToFormValues,
  validateUnitForm,
  type FieldErrors,
  type UnitFormValues,
} from "@/lib/property-validation";
import type { RentalUnit } from "@/types/property";

type UnitFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyName: string;
  siblingUnits: RentalUnit[];
  /** The unit to edit, or null to add a new one. */
  unit: RentalUnit | null;
  /** Tenant on the unit's active tenancy, if any. */
  activeTenantName?: string;
  /** Changes whenever the dialog is reopened, so the form starts fresh. */
  formKey: number;
  onSaved: (unitNumber: string) => void;
};

export function UnitFormDialog({
  open,
  onOpenChange,
  propertyName,
  unit,
  formKey,
  onSaved,
  ...formProps
}: UnitFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{unit ? `Edit unit ${unit.unitNumber}` : "Add unit"}</DialogTitle>
          <DialogDescription>
            {propertyName}. All fields are required unless marked optional.
          </DialogDescription>
        </DialogHeader>
        <UnitForm
          key={formKey}
          unit={unit}
          onSaved={(unitNumber) => {
            onOpenChange(false);
            onSaved(unitNumber);
          }}
          {...formProps}
        />
      </DialogContent>
    </Dialog>
  );
}

type UnitFormProps = {
  propertyId: string;
  siblingUnits: RentalUnit[];
  unit: RentalUnit | null;
  activeTenantName?: string;
  onSaved: (unitNumber: string) => void;
};

function UnitForm({
  propertyId,
  siblingUnits,
  unit,
  activeTenantName,
  onSaved,
}: UnitFormProps) {
  const { addUnit, updateUnit } = usePortfolio();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<UnitFormValues>(() =>
    unit ? unitToFormValues(unit) : { ...unitToFormValues(), status: "Vacant" },
  );
  const [errors, setErrors] = useState<FieldErrors<UnitFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const lock = useSubmitLock();
  const [formError, setFormError] = useState<string>();

  const validationContext = { siblingUnits, currentUnitId: unit?.id, activeTenantName };

  function update(field: keyof UnitFormValues, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) {
      const result = validateUnitForm(next, validationContext);
      setErrors(result.success ? {} : result.errors);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    const result = validateUnitForm(values, validationContext);
    if (!result.success) {
      setErrors(result.errors);
      focusFirstInvalid(formRef.current);
      return;
    }

    if (!lock.acquire()) return;
    setFormError(undefined);
    const saved = unit
      ? await updateUnit(unit.id, result.data)
      : await addUnit(propertyId, result.data);
    if (!saved.ok) {
      lock.release();
      setFormError(saved.field === "unitNumber" ? undefined : saved.error);
      if (saved.field) setErrors({ [saved.field]: saved.error });
      focusFirstInvalid(formRef.current);
      return;
    }
    onSaved(result.data.unitNumber);
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <FormField
          id="unit-number"
          label="Unit number"
          description="Must be unique within this property."
          error={errors.unitNumber}
          className="sm:col-span-3"
        >
          {(control) => (
            <Input
              {...control}
              value={values.unitNumber}
              onChange={(event) => update("unitNumber", event.target.value)}
              placeholder="e.g. A-101"
              autoComplete="off"
            />
          )}
        </FormField>

        <FormField
          id="unit-status"
          label="Status"
          error={errors.status}
          className="sm:col-span-3"
        >
          {(control) => (
            <NativeSelect
              {...control}
              value={values.status}
              onChange={(event) => update("status", event.target.value)}
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Select status
              </NativeSelectOption>
              {UNIT_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {status}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField
          id="unit-floor"
          label="Floor"
          optional
          description="0 for ground."
          error={errors.floor}
          className="sm:col-span-2"
        >
          {(control) => (
            <Input
              {...control}
              value={values.floor}
              onChange={(event) => update("floor", event.target.value)}
              inputMode="numeric"
            />
          )}
        </FormField>

        <FormField
          id="unit-bedrooms"
          label="Bedrooms"
          optional
          error={errors.bedrooms}
          className="sm:col-span-2"
        >
          {(control) => (
            <Input
              {...control}
              value={values.bedrooms}
              onChange={(event) => update("bedrooms", event.target.value)}
              inputMode="numeric"
            />
          )}
        </FormField>

        <FormField
          id="unit-bathrooms"
          label="Bathrooms"
          optional
          error={errors.bathrooms}
          className="sm:col-span-2"
        >
          {(control) => (
            <Input
              {...control}
              value={values.bathrooms}
              onChange={(event) => update("bathrooms", event.target.value)}
              inputMode="numeric"
            />
          )}
        </FormField>

        <FormField
          id="unit-rent"
          label="Monthly rent"
          error={errors.monthlyRent}
          className="sm:col-span-3"
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
          id="unit-deposit"
          label="Security deposit"
          optional
          error={errors.securityDeposit}
          className="sm:col-span-3"
        >
          {(control) => (
            <RupeeInput
              {...control}
              value={values.securityDeposit}
              onChange={(value) => update("securityDeposit", value)}
            />
          )}
        </FormField>
      </div>

      <DialogFooter className="flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
        <FormError message={formError} />
        <div className="flex justify-end gap-2">
        <DialogClose render={<Button type="button" variant="outline" disabled={lock.pending} />}>
          Cancel
        </DialogClose>
        <SubmitButton pending={lock.pending} pendingLabel="Saving…">
          {unit ? "Save changes" : "Add unit"}
        </SubmitButton>
        </div>
      </DialogFooter>
    </form>
  );
}