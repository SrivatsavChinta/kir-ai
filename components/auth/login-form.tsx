"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, type AuthFormState } from "@/lib/auth/actions";
import { SubmitButton } from "@/components/feedback/form-feedback";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";

const initialState: AuthFormState = {};

function LoginSubmit() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} pendingLabel="Logging in…" className="w-full">
      Log in
    </SubmitButton>
  );
}

export function LoginForm({ nextPath, confirmFailed }: { nextPath: string; confirmFailed: boolean }) {
  const [state, action] = useActionState(signIn, initialState);

  return (
    <form action={action} noValidate className="grid gap-5">
      <input type="hidden" name="next" value={nextPath} />
      {confirmFailed && (
        <p role="alert" className="text-sm text-destructive">
          That confirmation link didn&apos;t work. Log in if you already confirmed, or register again.
        </p>
      )}
      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}
      <FormField id="login-email" label="Email" error={state.fieldErrors?.email}>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="email" required />
        )}
      </FormField>
      <FormField id="login-password" label="Password" error={state.fieldErrors?.password}>
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </FormField>
      <LoginSubmit />
      <p className="text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/register" className={linkClass}>
          Create one
        </Link>
      </p>
    </form>
  );
}

const linkClass = "font-medium text-foreground underline-offset-4 hover:underline";
