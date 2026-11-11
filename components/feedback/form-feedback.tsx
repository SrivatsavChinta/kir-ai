"use client";

import { useRef, useState } from "react";

import { Spinner } from "@/components/feedback/spinner";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = Omit<React.ComponentProps<typeof Button>, "type"> & {
  pending: boolean;
  /** Shown while pending, e.g. "Saving…". */
  pendingLabel: string;
};

/** A form's submit button, disabled with a spinner while the submission runs. */
export function SubmitButton({ pending, pendingLabel, disabled, children, ...props }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-disabled={pending || undefined} {...props}>
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** A form-level error, for problems that don't belong to a single field. */
export function FormError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/**
 * Prevents a form from being submitted twice. Call `acquire()` once the input
 * is valid, before changing any state; it returns false while a submission is
 * already running. Call `release()` if the submission failed or the form stays
 * open afterwards. Forms that close or navigate on success stay locked.
 */
export function useSubmitLock() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  return {
    pending,
    acquire(): boolean {
      if (locked.current) return false;
      locked.current = true;
      setPending(true);
      return true;
    },
    release() {
      locked.current = false;
      setPending(false);
    },
  };
}
