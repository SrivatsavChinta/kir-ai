"use client";

import { useState } from "react";

import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
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

export type ConfirmResult = { ok: true } | { ok: false; error: string };

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes whenever the dialog is reopened, so earlier errors are cleared. */
  formKey: number;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  /** Destructive actions use the destructive button style. Defaults to true. */
  destructive?: boolean;
  /** Runs the action. The dialog closes only if it succeeds. */
  onConfirm: () => ConfirmResult | Promise<ConfirmResult>;
};

/** Asks the landlord to confirm an action that can't be undone. */
export function ConfirmDialog({
  open,
  onOpenChange,
  formKey,
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription render={<div />}>{description}</DialogDescription>
        </DialogHeader>
        <ConfirmForm
          key={formKey}
          confirmLabel={confirmLabel}
          pendingLabel={pendingLabel}
          destructive={destructive}
          onConfirm={onConfirm}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type ConfirmFormProps = Pick<
  ConfirmDialogProps,
  "confirmLabel" | "pendingLabel" | "destructive" | "onConfirm"
> & { onDone: () => void };

function ConfirmForm({ confirmLabel, pendingLabel, destructive, onConfirm, onDone }: ConfirmFormProps) {
  const lock = useSubmitLock();
  const [error, setError] = useState<string>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lock.acquire()) return;
    const result = await onConfirm();
    if (!result.ok) {
      lock.release();
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={lock.pending} className="space-y-4">
      <FormError message={error} />
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={lock.pending} />}>
          Cancel
        </DialogClose>
        <SubmitButton
          variant={destructive ? "destructive" : "default"}
          pending={lock.pending}
          pendingLabel={pendingLabel}
        >
          {confirmLabel}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
