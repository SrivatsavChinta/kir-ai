"use client";

import { useState } from "react";

import { SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { FormField } from "@/components/form-field";
import { useMaintenance } from "@/components/maintenance/maintenance-provider";
import { useFormatters } from "@/components/settings/settings-provider";
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
import { Textarea } from "@/components/ui/textarea";
import { MAX_NOTE_LENGTH } from "@/lib/maintenance";
import type { MaintenanceRequest, MaintenanceStatus } from "@/types/maintenance";

/** Button label for moving a request to `target`. */
export function statusActionLabel(from: MaintenanceStatus, target: MaintenanceStatus): string {
  switch (target) {
    case "In Progress":
      return from === "On Hold" ? "Resume work" : "Start work";
    case "On Hold":
      return "Put on hold";
    case "Resolved":
      return "Mark resolved";
    case "Closed":
      return "Close request";
    case "Open":
      return "Reopen";
  }
}

function explain(
  request: MaintenanceRequest,
  target: MaintenanceStatus,
  formatDateTime: (timestamp: string) => string,
): string {
  if (target === "Resolved") {
    return "Records the time it was resolved. If the issue comes back you can reopen it, and this resolution stays in the history.";
  }
  if (target === "Closed") {
    return "Closing is final: the request can no longer be edited or reopened. You can still add notes.";
  }
  if (request.status === "Resolved") {
    const when = request.resolvedAt ? ` on ${formatDateTime(request.resolvedAt)}` : "";
    return `The request goes back to Open. Its resolution${when} is kept in the history.`;
  }
  return `Status changes from ${request.status} to ${target}.`;
}

type ChangeStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formKey: number;
  request: MaintenanceRequest;
  target: MaintenanceStatus | null;
  onChanged: (request: MaintenanceRequest) => void;
};

export function ChangeStatusDialog({
  open,
  onOpenChange,
  formKey,
  request,
  target,
  onChanged,
}: ChangeStatusDialogProps) {
  const { formatDateTime } = useFormatters();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>{statusActionLabel(request.status, target)}</DialogTitle>
              <DialogDescription>{explain(request, target, formatDateTime)}</DialogDescription>
            </DialogHeader>
            <ChangeStatusForm
              key={formKey}
              request={request}
              target={target}
              onChanged={(updated) => {
                onOpenChange(false);
                onChanged(updated);
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ChangeStatusFormProps = {
  request: MaintenanceRequest;
  target: MaintenanceStatus;
  onChanged: (request: MaintenanceRequest) => void;
};

function ChangeStatusForm({ request, target, onChanged }: ChangeStatusFormProps) {
  const { changeStatus } = useMaintenance();
  const lock = useSubmitLock();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lock.acquire()) return;
    const result = await changeStatus(request.id, target, note);
    if (!result.ok) {
      lock.release();
      setError(result.error);
      return;
    }
    onChanged(result.value);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <FormField
        id="status-note"
        label="Note"
        optional
        description={target === "Resolved" ? "e.g. what was fixed and by whom." : undefined}
        error={error}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            maxLength={MAX_NOTE_LENGTH + 100}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setError(undefined);
            }}
          />
        )}
      </FormField>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={lock.pending} />}>
          Cancel
        </DialogClose>
        <SubmitButton
          variant={target === "Closed" ? "destructive" : "default"}
          pending={lock.pending}
          pendingLabel="Saving…"
        >
          {statusActionLabel(request.status, target)}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
