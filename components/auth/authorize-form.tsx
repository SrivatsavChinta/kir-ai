"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { decideAccess, type AuthorizeState } from "@/app/oauth/authorize/actions";
import { SubmitButton } from "@/components/feedback/form-feedback";
import { Button } from "@/components/ui/button";

const initial: AuthorizeState = {};

export function AuthorizeForm({ fields }: { fields: Record<string, string> }) {
  const [state, action] = useActionState(decideAccess, initial);

  return (
    <form action={action} className="grid gap-4">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Decisions />
    </form>
  );
}

function Decisions() {
  const { pending } = useFormStatus();
  return (
    <>
      <SubmitButton pending={pending} pendingLabel="Connecting…" name="decision" value="approve">
        Allow Claude
      </SubmitButton>
      <Button type="submit" name="decision" value="deny" variant="outline" disabled={pending}>
        Deny
      </Button>
    </>
  );
}
