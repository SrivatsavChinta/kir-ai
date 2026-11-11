"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { focusFirstInvalid, FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { usePortfolio } from "@/components/portfolio-provider";
import { PropertyNotFound } from "@/components/properties/property-not-found";
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
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES_AND_UNION_TERRITORIES } from "@/lib/indian-states";
import { PROPERTY_TYPES } from "@/lib/properties";
import {
  propertyToFormValues,
  validatePropertyForm,
  type FieldErrors,
  type PropertyFormValues,
} from "@/lib/property-validation";
import type { Property } from "@/types/property";

type PropertyFormProps = {
  /** When provided, the form edits this property instead of creating one. */
  property?: Property;
};

export function PropertyForm({ property }: PropertyFormProps) {
  const router = useRouter();
  const { addProperty, updateProperty } = usePortfolio();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(() => propertyToFormValues(property));
  const [errors, setErrors] = useState<FieldErrors<PropertyFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string>();
  const lock = useSubmitLock();

  const cancelHref = property ? `/properties/${property.id}` : "/properties";

  function update(field: keyof PropertyFormValues, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) {
      const result = validatePropertyForm(next);
      setErrors(result.success ? {} : result.errors);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    const result = validatePropertyForm(values);
    if (!result.success) {
      setErrors(result.errors);
      focusFirstInvalid(formRef.current);
      return;
    }

    if (!lock.acquire()) return;
    setFormError(undefined);
    const saved = property
      ? await updateProperty(property.id, result.data)
      : await addProperty(result.data);
    if (!saved.ok) {
      lock.release();
      setFormError(saved.error);
      return;
    }
    router.push(property ? `/properties/${property.id}` : `/properties/${saved.value.id}`);
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Property details
          </CardTitle>
          <CardDescription>
            All fields are required unless marked optional.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField id="property-name" label="Property name" error={errors.name}>
            {(control) => (
              <Input
                {...control}
                value={values.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="e.g. Lakeview Residency"
                autoComplete="off"
              />
            )}
          </FormField>

          <FormField
            id="property-type"
            label="Property type"
            error={errors.propertyType}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={values.propertyType}
                onChange={(event) => update("propertyType", event.target.value)}
                className="w-full"
              >
                <NativeSelectOption value="" disabled>
                  Select a type
                </NativeSelectOption>
                {PROPERTY_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {type}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField
            id="property-address"
            label="Street address"
            description="Building number, street and locality."
            error={errors.address}
            className="sm:col-span-2"
          >
            {(control) => (
              <Input
                {...control}
                value={values.address}
                onChange={(event) => update("address", event.target.value)}
                placeholder="e.g. 21, EPIP Zone Main Road, Whitefield"
                autoComplete="street-address"
              />
            )}
          </FormField>

          <FormField id="property-city" label="City" error={errors.city}>
            {(control) => (
              <Input
                {...control}
                value={values.city}
                onChange={(event) => update("city", event.target.value)}
                placeholder="e.g. Bengaluru"
                autoComplete="address-level2"
              />
            )}
          </FormField>

          <FormField
            id="property-state"
            label="State or union territory"
            error={errors.state}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={values.state}
                onChange={(event) => update("state", event.target.value)}
                className="w-full"
                autoComplete="address-level1"
              >
                <NativeSelectOption value="" disabled>
                  Select a state
                </NativeSelectOption>
                {INDIAN_STATES_AND_UNION_TERRITORIES.map((state) => (
                  <NativeSelectOption key={state} value={state}>
                    {state}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField id="property-pincode" label="Pincode" error={errors.pincode}>
            {(control) => (
              <Input
                {...control}
                value={values.pincode}
                onChange={(event) => update("pincode", event.target.value)}
                placeholder="e.g. 560066"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
              />
            )}
          </FormField>

          <FormField
            id="property-description"
            label="Description"
            optional
            description="Notes such as amenities or access details. Up to 500 characters."
            error={errors.description}
            className="sm:col-span-2"
          >
            {(control) => (
              <Textarea
                {...control}
                value={values.description}
                onChange={(event) => update("description", event.target.value)}
                rows={3}
              />
            )}
          </FormField>
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <FormError message={formError} />
          <div className="flex justify-end gap-2">
            <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>
            <SubmitButton pending={lock.pending} pendingLabel="Saving…">
              {property ? "Save changes" : "Add property"}
            </SubmitButton>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}

export function EditPropertyForm({ propertyId }: { propertyId: string }) {
  const { properties } = usePortfolio();
  const property = properties.find((candidate) => candidate.id === propertyId);

  if (!property) return <PropertyNotFound />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit property"
        description={property.name}
        back={{ href: `/properties/${property.id}`, label: property.name }}
      />
      <PropertyForm property={property} />
    </div>
  );
}
