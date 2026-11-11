"use client";

import { useState } from "react";

import { SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { FormField } from "@/components/form-field";
import { usePortfolio } from "@/components/portfolio-provider";
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
import { validateMoveOutDate } from "@/lib/tenant-validation";
import type { Tenancy } from "@/types/tenancy";

type EndTenancyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenancy: Tenancy;
  tenantName: string;
  /** e.g. "Lakeview Residency, A-101". */
  location: string;
  /** Changes whenever the dialog is reopened, so the form starts fresh. */
  formKey: number;
};

export function EndTenancyDialog({
  open,
  onOpenChange,
  formKey,
  ...formProps
}: EndTenancyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>End tenancy</DialogTitle>
          <DialogDescription>
            {formProps.tenantName} at {formProps.location}. The tenancy stays in
            their history, they become a former tenant, and the unit is marked
            vacant. An ended tenancy can&apos;t be reopened.
          </DialogDescription>
        </DialogHeader>
        <EndTenancyForm key={formKey} onDone={() => onOpenChange(false)} {...formProps} />
      </DialogContent>
    </Dialog>
  );
}

type EndTenancyFormProps = Omit<EndTenancyDialogProps, "open" | "onOpenChange" | "formKey"> & {
  onDone: () => void;
};

function EndTenancyForm({ tenancy, onDone }: EndTenancyFormProps) {
  const { today, endTenancy } = usePortfolio();
  const [moveOutDate, setMoveOutDate] = useState("");
  const [error, setError] = useState<string>();
  const lock = useSubmitLock();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateMoveOutDate(moveOutDate, tenancy, today);
    if (!result.success) {
      setError(result.error);
      document.getElementById("move-out-date")?.focus();
      return;
    }
    if (!lock.acquire()) return;
    const ended = await endTenancy(tenancy.id, result.data);
    if (!ended.ok) {
      lock.release();
      setError(ended.error);
      return;
    }
    onDone();
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      <FormField
        id="move-out-date"
        label="Move-out date"
        description="The day the tenant handed the unit back."
        error={error}
      >
        {(control) => (
          <Input
            {...control}
            type="date"
            value={moveOutDate}
            onChange={(event) => {
              setMoveOutDate(event.target.value);
              setError(undefined);
            }}
          />
        )}
      </FormField>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={lock.pending} />}>
          Cancel
        </DialogClose>
        <SubmitButton variant="destructive" pending={lock.pending} pendingLabel="Ending…">
          End tenancy
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
