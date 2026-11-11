"use client";

import { useRef, useState } from "react";

import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { focusFirstInvalid, FormField } from "@/components/form-field";
import { useMaintenance } from "@/components/maintenance/maintenance-provider";
import { VendorFields } from "@/components/maintenance/vendor-fields";
import { describeVendor, VendorSelect } from "@/components/maintenance/vendor-select";
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
import {
  emptyVendorValues,
  NEW_VENDOR,
  validateVendorForm,
  type VendorFormValues,
} from "@/lib/maintenance-validation";
import type { FieldErrors } from "@/lib/validation";
import type { MaintenanceRequest, VendorChoice } from "@/types/maintenance";

type AssignVendorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formKey: number;
  request: MaintenanceRequest;
  onAssigned: (request: MaintenanceRequest) => void;
};

export function AssignVendorDialog({
  open,
  onOpenChange,
  formKey,
  request,
  onAssigned,
}: AssignVendorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{request.assignedVendorId ? "Change vendor" : "Assign vendor"}</DialogTitle>
          <DialogDescription>
            Choose an existing vendor or add a new one. kir.ai doesn&apos;t contact vendors for you.
          </DialogDescription>
        </DialogHeader>
        <AssignVendorForm
          key={formKey}
          request={request}
          onAssigned={(updated) => {
            onOpenChange(false);
            onAssigned(updated);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function AssignVendorForm({
  request,
  onAssigned,
}: {
  request: MaintenanceRequest;
  onAssigned: (request: MaintenanceRequest) => void;
}) {
  const { vendors, assignVendor } = useMaintenance();
  const formRef = useRef<HTMLFormElement>(null);
  const lock = useSubmitLock();
  const [vendorId, setVendorId] = useState(request.assignedVendorId ?? "");
  const [vendor, setVendor] = useState<VendorFormValues>(emptyVendorValues(request.category));
  const [errors, setErrors] = useState<FieldErrors<VendorFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string>();
  const selected = vendors.find((candidate) => candidate.id === vendorId);

  function updateVendor(next: VendorFormValues) {
    setVendor(next);
    setFormError(undefined);
    if (submitted) {
      const result = validateVendorForm(next, vendors);
      setErrors(result.success ? {} : result.errors);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.pending) return;
    setSubmitted(true);
    let choice: VendorChoice = vendorId ? { kind: "existing", vendorId } : { kind: "none" };
    if (vendorId === NEW_VENDOR) {
      const checked = validateVendorForm(vendor, vendors);
      if (!checked.success) {
        setErrors(checked.errors);
        focusFirstInvalid(formRef.current);
        return;
      }
      choice = { kind: "new", vendor: checked.data };
    }
    if (!lock.acquire()) return;
    const result = await assignVendor(request.id, choice);
    if (!result.ok) {
      lock.release();
      setFormError(result.error);
      return;
    }
    onAssigned(result.value);
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-4">
      <FormField
        id="assign-vendor"
        label="Vendor"
        description={selected ? describeVendor(selected) : undefined}
      >
        {(control) => (
          <VendorSelect
            {...control}
            vendors={vendors}
            category={request.category}
            value={vendorId}
            onChange={(event) => {
              setVendorId(event.target.value);
              setFormError(undefined);
            }}
          />
        )}
      </FormField>
      {vendorId === NEW_VENDOR && (
        <VendorFields
          idPrefix="assign-new-vendor"
          values={vendor}
          errors={errors}
          onChange={updateVendor}
        />
      )}
      <FormError message={formError} />
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={lock.pending} />}>
          Cancel
        </DialogClose>
        <SubmitButton pending={lock.pending} pendingLabel="Saving…">
          Save vendor
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
