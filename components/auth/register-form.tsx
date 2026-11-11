"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { SubmitButton } from "@/components/feedback/form-feedback";
import { FormField } from "@/components/form-field";
import { signUp, type AuthFormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";

const initialState: AuthFormState = {};

function RegisterSubmit() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} pendingLabel="Creating account…" className="w-full">
      Create account
    </SubmitButton>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(signUp, initialState);

  if (state.message) {
    return (
      <div className="space-y-4 text-sm" role="status">
        <p>{state.message}</p>
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        All fields are required unless marked optional. This account starts with an empty
        portfolio.
      </p>
      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}
      <FormField id="register-name" label="Full name" error={state.fieldErrors?.fullName}>
        {(control) => (
          <Input {...control} name="fullName" autoComplete="name" required maxLength={80} />
        )}
      </FormField>
      <FormField id="register-email" label="Email" error={state.fieldErrors?.email}>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="email" required />
        )}
      </FormField>
      <FormField
        id="register-phone"
        label="Mobile number"
        optional
        description="10-digit Indian mobile number."
        error={state.fieldErrors?.phone}
      >
        {(control) => (
          <Input {...control} name="phone" type="tel" autoComplete="tel" />
        )}
      </FormField>
      <FormField
        id="register-password"
        label="Password"
        description="At least 8 characters."
        error={state.fieldErrors?.password}
      >
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        )}
      </FormField>
      <RegisterSubmit />
      <p className="text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
