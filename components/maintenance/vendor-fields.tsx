"use client";

import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { MAINTENANCE_CATEGORIES } from "@/lib/maintenance";
import type { VendorFormValues } from "@/lib/maintenance-validation";
import type { FieldErrors } from "@/lib/validation";
import type { MaintenanceCategory } from "@/types/maintenance";

type VendorFieldsProps = {
  idPrefix: string;
  values: VendorFormValues;
  errors?: FieldErrors<VendorFormValues>;
  onChange: (values: VendorFormValues) => void;
};

/** Details for a new vendor. Kept to what's needed to contact them. */
export function VendorFields({ idPrefix, values, errors = {}, onChange }: VendorFieldsProps) {
  const update = <K extends keyof VendorFormValues>(key: K, value: VendorFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <fieldset className="min-w-0 space-y-4 rounded-lg border bg-muted/30 p-3">
      <legend className="px-1 text-sm font-medium">New vendor</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id={`${idPrefix}-name`} label="Vendor name" error={errors.name}>
          {(control) => (
            <Input
              {...control}
              value={values.name}
              placeholder="e.g. Sharma Plumbing Works"
              onChange={(event) => update("name", event.target.value)}
            />
          )}
        </FormField>
        <FormField id={`${idPrefix}-category`} label="Service" error={errors.serviceCategory}>
          {(control) => (
            <NativeSelect
              {...control}
              value={values.serviceCategory}
              onChange={(event) =>
                update("serviceCategory", event.target.value as MaintenanceCategory)
              }
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Select a service
              </NativeSelectOption>
              {MAINTENANCE_CATEGORIES.map((category) => (
                <NativeSelectOption key={category} value={category}>
                  {category}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id={`${idPrefix}-phone`} label="Phone" optional error={errors.phone}>
          {(control) => (
            <Input
              {...control}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={values.phone}
              placeholder="98450 12345"
              onChange={(event) => update("phone", event.target.value)}
            />
          )}
        </FormField>
        <FormField id={`${idPrefix}-email`} label="Email" optional error={errors.email}>
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="off"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
            />
          )}
        </FormField>
      </div>
      <FormField id={`${idPrefix}-notes`} label="Notes" optional error={errors.notes}>
        {(control) => (
          <Textarea
            {...control}
            rows={2}
            value={values.notes}
            placeholder="e.g. Available weekdays after 10 am"
            onChange={(event) => update("notes", event.target.value)}
          />
        )}
      </FormField>
    </fieldset>
  );
}
