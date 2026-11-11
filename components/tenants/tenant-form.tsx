"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { focusFirstInvalid, FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { usePortfolio } from "@/components/portfolio-provider";
import { TenancyFields } from "@/components/tenants/tenancy-form";
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
import { Textarea } from "@/components/ui/textarea";
import {
  tenancyToFormValues,
  tenantToFormValues,
  validateTenancyForm,
  validateTenantForm,
  type TenancyFormValues,
  type TenantFormValues,
} from "@/lib/tenant-validation";
import { findTenant } from "@/lib/tenants";
import type { FieldErrors } from "@/lib/validation";
import type { Tenant } from "@/types/tenant";

type TenantDetailsFieldsProps = {
  values: TenantFormValues;
  errors: FieldErrors<TenantFormValues>;
  onChange: (values: TenantFormValues) => void;
};

function TenantDetailsFields({ values, errors, onChange }: TenantDetailsFieldsProps) {
  function update(field: keyof TenantFormValues, value: string) {
    onChange({ ...values, [field]: value });
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <FormField
        id="tenant-name"
        label="Full name"
        error={errors.fullName}
        className="sm:col-span-2"
      >
        {(control) => (
          <Input
            {...control}
            value={values.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            placeholder="e.g. Priya Sharma"
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField
        id="tenant-phone"
        label="Phone number"
        description="10-digit Indian mobile number."
        error={errors.phone}
      >
        {(control) => (
          <Input
            {...control}
            type="tel"
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            placeholder="e.g. 98450 12345"
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField id="tenant-email" label="Email" error={errors.email}>
        {(control) => (
          <Input
            {...control}
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            placeholder="e.g. priya@example.com"
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField
        id="tenant-address"
        label="Current address"
        optional
        description="For example, a permanent home address for correspondence."
        error={errors.currentAddress}
        className="sm:col-span-2"
      >
        {(control) => (
          <Textarea
            {...control}
            value={values.currentAddress}
            onChange={(event) => update("currentAddress", event.target.value)}
            rows={2}
          />
        )}
      </FormField>

      <FormField
        id="tenant-emergency-name"
        label="Emergency contact name"
        optional
        error={errors.emergencyContactName}
      >
        {(control) => (
          <Input
            {...control}
            value={values.emergencyContactName}
            onChange={(event) => update("emergencyContactName", event.target.value)}
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField
        id="tenant-emergency-phone"
        label="Emergency contact phone"
        optional
        error={errors.emergencyContactPhone}
      >
        {(control) => (
          <Input
            {...control}
            type="tel"
            value={values.emergencyContactPhone}
            onChange={(event) => update("emergencyContactPhone", event.target.value)}
            autoComplete="off"
          />
        )}
      </FormField>
    </div>
  );
}

/** Adds a tenant together with their first tenancy on a vacant unit. */
export function NewTenantForm() {
  const router = useRouter();
  const { today, units, tenants, tenancies, addTenant } = usePortfolio();
  const formRef = useRef<HTMLFormElement>(null);
  const [tenantValues, setTenantValues] = useState(() => tenantToFormValues());
  const [tenancyValues, setTenancyValues] = useState(() => tenancyToFormValues());
  const [tenantErrors, setTenantErrors] = useState<FieldErrors<TenantFormValues>>({});
  const [tenancyErrors, setTenancyErrors] = useState<FieldErrors<TenancyFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string>();
  const lock = useSubmitLock();

  const tenantContext = { tenants };
  const tenancyContext = { units, tenants, tenancies, today };

  function validate(nextTenant: TenantFormValues, nextTenancy: TenancyFormValues) {
    const tenant = validateTenantForm(nextTenant, tenantContext);
    const tenancy = validateTenancyForm(nextTenancy, tenancyContext);
    setTenantErrors(tenant.success ? {} : tenant.errors);
    setTenancyErrors(tenancy.success ? {} : tenancy.errors);
    return { tenant, tenancy };
  }

  function handleTenantChange(next: TenantFormValues) {
    setTenantValues(next);
    setFormError(undefined);
    if (submitted) validate(next, tenancyValues);
  }

  function handleTenancyChange(next: TenancyFormValues) {
    setTenancyValues(next);
    setFormError(undefined);
    if (submitted) validate(tenantValues, next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    const { tenant, tenancy } = validate(tenantValues, tenancyValues);
    if (!tenant.success || !tenancy.success) {
      focusFirstInvalid(formRef.current);
      return;
    }

    if (!lock.acquire()) return;
    const saved = await addTenant(tenant.data, tenancy.data);
    if (!saved.ok) {
      lock.release();
      if (saved.field === "unitId") {
        setTenancyErrors({ unitId: saved.error });
        focusFirstInvalid(formRef.current);
      } else {
        setFormError(saved.error);
      }
      return;
    }
    router.push(`/tenants/${saved.value.tenant.id}`);
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Personal information
          </CardTitle>
          <CardDescription>All fields are required unless marked optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <TenantDetailsFields
            values={tenantValues}
            errors={tenantErrors}
            onChange={handleTenantChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Tenancy
          </CardTitle>
          <CardDescription>
            The unit this tenant is renting. The unit is marked occupied when you save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <TenancyFields
            values={tenancyValues}
            errors={tenancyErrors}
            onChange={handleTenancyChange}
          />
          <FormError message={formError} />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Link href="/tenants" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton pending={lock.pending} pendingLabel="Adding…">
            Add tenant
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}

export function EditTenantDetails({ tenantId }: { tenantId: string }) {
  const { tenants } = usePortfolio();
  const tenant = findTenant(tenants, tenantId);
  if (!tenant) return <TenantNotFound />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit tenant details"
        description={tenant.fullName}
        back={{ href: `/tenants/${tenant.id}`, label: tenant.fullName }}
      />
      <EditTenantForm tenant={tenant} />
    </div>
  );
}

function EditTenantForm({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const { tenants, updateTenant } = usePortfolio();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(() => tenantToFormValues(tenant));
  const [errors, setErrors] = useState<FieldErrors<TenantFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const lock = useSubmitLock();

  const context = { tenants, currentTenantId: tenant.id };
  const profileHref = `/tenants/${tenant.id}`;

  function handleChange(next: TenantFormValues) {
    setValues(next);
    if (submitted) {
      const result = validateTenantForm(next, context);
      setErrors(result.success ? {} : result.errors);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    const result = validateTenantForm(values, context);
    if (!result.success) {
      setErrors(result.errors);
      focusFirstInvalid(formRef.current);
      return;
    }
    if (!lock.acquire()) return;
    const saved = await updateTenant(tenant.id, result.data);
    if (!saved.ok) {
      lock.release();
      setErrors({ [saved.field ?? "fullName"]: saved.error });
      focusFirstInvalid(formRef.current);
      return;
    }
    router.push(profileHref);
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Personal information
          </CardTitle>
          <CardDescription>
            Changes apply to the tenant&apos;s record across all of their tenancies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantDetailsFields values={values} errors={errors} onChange={handleChange} />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Link href={profileHref} className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton pending={lock.pending} pendingLabel="Saving…">
            Save changes
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
