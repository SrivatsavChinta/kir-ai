"use client";

import { useState } from "react";

import { DocumentFileField } from "@/components/documents/document-file-field";
import { useDocuments } from "@/components/documents/documents-provider";
import { SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
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
import { validateDocumentFile } from "@/lib/document-validation";
import { getFileTypeLabel } from "@/lib/documents";
import { formatFileSize } from "@/lib/format";
import type { DocumentRecord } from "@/types/document";

type ReplaceDocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes whenever the dialog is reopened, so the form starts fresh. */
  formKey: number;
  document: DocumentRecord | null;
  onReplaced: (document: DocumentRecord) => void;
};

export function ReplaceDocumentDialog({
  open,
  onOpenChange,
  formKey,
  document,
  onReplaced,
}: ReplaceDocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Replace file</DialogTitle>
          <DialogDescription>
            Upload a new file for this document. Its name, category and link stay the same.
            The current file is permanently deleted and can&apos;t be restored.
          </DialogDescription>
        </DialogHeader>
        {document && (
          <ReplaceDocumentForm
            key={formKey}
            document={document}
            onReplaced={(updated) => {
              onOpenChange(false);
              onReplaced(updated);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type ReplaceDocumentFormProps = {
  document: DocumentRecord;
  onReplaced: (document: DocumentRecord) => void;
};

function ReplaceDocumentForm({ document, onReplaced }: ReplaceDocumentFormProps) {
  const { replaceDocumentFile } = useDocuments();
  const { formatDateTime } = useFormatters();
  const lock = useSubmitLock();
  const pending = lock.pending;
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();

  function selectFile(next: File | null) {
    setFile(next);
    const checked = validateDocumentFile(next);
    setError(next && !checked.success ? checked.error : undefined);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const checked = validateDocumentFile(file);
    if (!checked.success) {
      setError(checked.error);
      window.document.getElementById("replace-document-file")?.focus();
      return;
    }

    if (!lock.acquire()) return;
    const saved = await replaceDocumentFile(document.id, checked.data.file);
    if (!saved.ok) {
      lock.release();
      setError(saved.error);
      return;
    }
    onReplaced(saved.value);
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={pending} className="space-y-5">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Document</dt>
          <dd className="font-medium break-words">{document.name}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Current file</dt>
          <dd className="break-all">{document.originalFileName}</dd>
          <dd className="text-xs text-muted-foreground">
            {getFileTypeLabel(document.mimeType)} · {formatFileSize(document.fileSize)} ·
            uploaded {formatDateTime(document.uploadedAt)}
          </dd>
        </div>
      </dl>

      <fieldset disabled={pending} className="min-w-0">
        <DocumentFileField
          id="replace-document-file"
          label="New file"
          file={file}
          error={error}
          onChange={selectFile}
        />
      </fieldset>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancel
        </DialogClose>
        <SubmitButton pending={pending} pendingLabel="Replacing…">
          Replace file
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
