"use client";

import { useMemo, useRef, useState } from "react";

import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { focusFirstInvalid, FormField } from "@/components/form-field";
import { useMaintenance } from "@/components/maintenance/maintenance-provider";
import { VendorFields } from "@/components/maintenance/vendor-fields";
import { describeVendor, VendorSelect } from "@/components/maintenance/vendor-select";
import { usePortfolio } from "@/components/portfolio-provider";
import { useFormatters } from "@/components/settings/settings-provider";
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
import { Textarea } from "@/components/ui/textarea";
import { isCalendarDate } from "@/lib/dates";
import {
  getEligibleTenants,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
} from "@/lib/maintenance";
import {
  emptyVendorValues,
  getAssociationErrors,
  NEW_VENDOR,
  requestToFormValues,
  validateMaintenanceForm,
  type MaintenanceFormErrors,
  type MaintenanceFormValues,
} from "@/lib/maintenance-validation";
import { getUnitsForProperty } from "@/lib/properties";
import { getActiveTenancyForUnit, getCurrentTenancy, getLatestTenancy } from "@/lib/tenants";
import type {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequest,
} from "@/types/maintenance";

/** The profile a new request starts from. */
export type RequestPreset = { propertyId?: string; tenantId?: string };

type MaintenanceRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes whenever the dialog is reopened, so the form starts fresh. */
  formKey: number;
  preset?: RequestPreset;
  /** The request to edit; a new request is created when omitted. */
  request?: MaintenanceRequest;
  onSaved: (request: MaintenanceRequest) => void;
};

export function MaintenanceRequestDialog({
  open,
  onOpenChange,
  formKey,
  preset,
  request,
  onSaved,
}: MaintenanceRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{request ? "Edit maintenance request" : "New maintenance request"}</DialogTitle>
          <DialogDescription>
            {request
              ? "Status is changed from the request page. Changes are recorded in its history."
              : "Log an issue for a whole property, a unit, or one reported by a tenant."}{" "}
            All fields are required unless marked optional.
          </DialogDescription>
        </DialogHeader>
        <MaintenanceRequestForm
          key={formKey}
          preset={preset}
          request={request}
          onSaved={(saved) => {
            onOpenChange(false);
            onSaved(saved);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

type MaintenanceRequestFormProps = {
  preset?: RequestPreset;
  request?: MaintenanceRequest;
  onSaved: (request: MaintenanceRequest) => void;
};

function MaintenanceRequestForm({ preset, request, onSaved }: MaintenanceRequestFormProps) {
  const { today, properties, units, tenants, tenancies } = usePortfolio();
  const { vendors, createRequest, updateRequest } = useMaintenance();
  const records = useMemo(
    () => ({ properties, units, tenants, tenancies }),
    [properties, units, tenants, tenancies],
  );
  const { formatDate } = useFormatters();
  const formRef = useRef<HTMLFormElement>(null);
  const lock = useSubmitLock();
  const pending = lock.pending;

  const [values, setValues] = useState<MaintenanceFormValues>(() => {
    if (request) return requestToFormValues(request);
    const initial: MaintenanceFormValues = {
      title: "",
      description: "",
      propertyId: preset?.propertyId ?? "",
      unitId: "",
      tenantId: "",
      category: "",
      priority: "",
      reportedAt: today,
      targetResolutionDate: "",
      vendorId: "",
      vendor: emptyVendorValues(),
    };
    if (preset?.tenantId) {
      // A tenant can only be linked through a tenancy, so start from their latest one.
      const tenancy =
        getCurrentTenancy(tenancies, preset.tenantId) ?? getLatestTenancy(tenancies, preset.tenantId);
      const unit = units.find((candidate) => candidate.id === tenancy?.unitId);
      if (unit) {
        initial.propertyId = unit.propertyId;
        initial.unitId = unit.id;
        initial.tenantId = preset.tenantId;
      }
    }
    return initial;
  });
  const [errors, setErrors] = useState<MaintenanceFormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string>();

  const context = { ...records, vendors, today, current: request };
  const shownErrors: MaintenanceFormErrors = submitted
    ? errors
    : getAssociationErrors(values, records, today);

  const propertyUnits = values.propertyId ? getUnitsForProperty(units, values.propertyId) : [];
  const tenantDate = isCalendarDate(values.reportedAt) ? values.reportedAt : today;
  const eligibleTenants = getEligibleTenants(records, {
    propertyId: values.propertyId,
    unitId: values.unitId || undefined,
    date: tenantDate,
  });
  const selectedTenantIneligible =
    values.tenantId && !eligibleTenants.some(({ tenant }) => tenant.id === values.tenantId)
      ? tenants.find((tenant) => tenant.id === values.tenantId)
      : undefined;
  const selectedVendor = vendors.find((vendor) => vendor.id === values.vendorId);

  function update(next: MaintenanceFormValues) {
    setValues(next);
    setFormError(undefined);
    if (submitted) {
      const result = validateMaintenanceForm(next, context);
      setErrors(result.success ? {} : result.errors);
    }
  }

  function selectProperty(propertyId: string) {
    // A different property invalidates the unit and tenant, so they're cleared rather than kept.
    update({ ...values, propertyId, unitId: "", tenantId: "" });
  }

  function selectVendor(vendorId: string) {
    update({
      ...values,
      vendorId,
      vendor:
        vendorId === NEW_VENDOR && values.vendorId !== NEW_VENDOR
          ? emptyVendorValues(values.category)
          : values.vendor,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    const result = validateMaintenanceForm(values, context);
    if (!result.success) {
      setErrors(result.errors);
      focusFirstInvalid(formRef.current);
      return;
    }

    if (!lock.acquire()) return;
    const saved = request
      ? await updateRequest(request.id, result.data.input, result.data.vendor)
      : await createRequest(result.data.input, result.data.vendor);
    if (!saved.ok) {
      lock.release();
      setFormError(saved.error);
      return;
    }
    onSaved(saved.value);
  }

  const sortedProperties = [...properties].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <FormField id="maintenance-title" label="Request title" error={shownErrors.title}>
          {(control) => (
            <Input
              {...control}
              value={values.title}
              maxLength={MAX_TITLE_LENGTH + 20}
              placeholder="e.g. Water leakage in bathroom"
              onChange={(event) => update({ ...values, title: event.target.value })}
            />
          )}
        </FormField>

        <FormField id="maintenance-description" label="Description" error={shownErrors.description}>
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              maxLength={MAX_DESCRIPTION_LENGTH + 100}
              value={values.description}
              placeholder="What's wrong, where exactly, and anything already tried"
              onChange={(event) => update({ ...values, description: event.target.value })}
            />
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField id="maintenance-category" label="Issue category" error={shownErrors.category}>
            {(control) => (
              <NativeSelect
                {...control}
                value={values.category}
                onChange={(event) =>
                  update({ ...values, category: event.target.value as MaintenanceCategory })
                }
                className="w-full"
              >
                <NativeSelectOption value="" disabled>
                  Select a category
                </NativeSelectOption>
                {MAINTENANCE_CATEGORIES.map((category) => (
                  <NativeSelectOption key={category} value={category}>
                    {category}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="maintenance-priority" label="Priority" error={shownErrors.priority}>
            {(control) => (
              <NativeSelect
                {...control}
                value={values.priority}
                onChange={(event) =>
                  update({ ...values, priority: event.target.value as MaintenancePriority })
                }
                className="w-full"
              >
                <NativeSelectOption value="" disabled>
                  Select a priority
                </NativeSelectOption>
                {MAINTENANCE_PRIORITIES.map((priority) => (
                  <NativeSelectOption key={priority} value={priority}>
                    {priority}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </div>

        <FormField id="maintenance-property" label="Property" error={shownErrors.propertyId}>
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
              {sortedProperties.map((property) => (
                <NativeSelectOption key={property.id} value={property.id}>
                  {property.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            id="maintenance-unit"
            label="Rental unit"
            optional
            description="Leave blank for common areas or the whole property."
            error={shownErrors.unitId}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={values.unitId}
                disabled={!values.propertyId}
                onChange={(event) => update({ ...values, unitId: event.target.value })}
                className="w-full"
              >
                <NativeSelectOption value="">
                  {values.propertyId ? "Whole property" : "Choose a property first"}
                </NativeSelectOption>
                {propertyUnits.map((unit) => {
                  const tenancy = getActiveTenancyForUnit(tenancies, unit.id);
                  const tenant = tenants.find((candidate) => candidate.id === tenancy?.tenantId);
                  return (
                    <NativeSelectOption key={unit.id} value={unit.id}>
                      {unit.unitNumber} · {tenant ? tenant.fullName : "Vacant"}
                    </NativeSelectOption>
                  );
                })}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id="maintenance-tenant"
            label="Tenant"
            optional
            description={
              values.propertyId
                ? `Tenants renting ${values.unitId ? "this unit" : "here"} on ${formatDate(tenantDate)}.`
                : undefined
            }
            error={shownErrors.tenantId}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={values.tenantId}
                disabled={!values.propertyId}
                onChange={(event) => update({ ...values, tenantId: event.target.value })}
                className="w-full"
              >
                <NativeSelectOption value="">
                  {!values.propertyId
                    ? "Choose a property first"
                    : eligibleTenants.length === 0
                      ? "No tenant on this date"
                      : "Not reported by a tenant"}
                </NativeSelectOption>
                {eligibleTenants.map(({ tenant }) => (
                  <NativeSelectOption key={tenant.id} value={tenant.id}>
                    {tenant.fullName}
                  </NativeSelectOption>
                ))}
                {selectedTenantIneligible && (
                  <NativeSelectOption value={selectedTenantIneligible.id}>
                    {selectedTenantIneligible.fullName} (not renting here then)
                  </NativeSelectOption>
                )}
              </NativeSelect>
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField id="maintenance-reported" label="Reported date" error={shownErrors.reportedAt}>
            {(control) => (
              <Input
                {...control}
                type="date"
                max={today}
                value={values.reportedAt}
                onChange={(event) => update({ ...values, reportedAt: event.target.value })}
              />
            )}
          </FormField>
          <FormField
            id="maintenance-target"
            label="Target resolution date"
            optional
            error={shownErrors.targetResolutionDate}
          >
            {(control) => (
              <Input
                {...control}
                type="date"
                min={isCalendarDate(values.reportedAt) ? values.reportedAt : undefined}
                value={values.targetResolutionDate}
                onChange={(event) =>
                  update({ ...values, targetResolutionDate: event.target.value })
                }
              />
            )}
          </FormField>
        </div>

        <FormField
          id="maintenance-vendor"
          label="Vendor"
          optional
          description={selectedVendor ? describeVendor(selectedVendor) : undefined}
          error={shownErrors.vendorId}
        >
          {(control) => (
            <VendorSelect
              {...control}
              vendors={vendors}
              category={values.category}
              value={values.vendorId}
              onChange={(event) => selectVendor(event.target.value)}
            />
          )}
        </FormField>
        {values.vendorId === NEW_VENDOR && (
          <VendorFields
            idPrefix="maintenance-new-vendor"
            values={values.vendor}
            errors={shownErrors.vendor}
            onChange={(vendor) => update({ ...values, vendor })}
          />
        )}
      </fieldset>

      <FormError message={formError} />

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancel
        </DialogClose>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          {request ? "Save changes" : "Create request"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
