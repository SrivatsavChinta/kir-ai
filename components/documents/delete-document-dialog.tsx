"use client";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useDocuments } from "@/components/documents/documents-provider";
import type { DocumentRecord } from "@/types/document";

type DeleteDocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes whenever the dialog is reopened, so the form starts fresh. */
  formKey: number;
  document: DocumentRecord | null;
  onDeleted: (document: DocumentRecord) => void;
};

export function DeleteDocumentDialog({
  open,
  onOpenChange,
  formKey,
  document,
  onDeleted,
}: DeleteDocumentDialogProps) {
  const { deleteDocument } = useDocuments();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      formKey={formKey}
      title="Delete document?"
      description={
        document && (
          <p>
            <span className="font-medium break-words text-foreground">{document.name}</span> and
            its file will be permanently deleted. This can&apos;t be undone.
          </p>
        )
      }
      confirmLabel="Delete document"
      pendingLabel="Deleting…"
      onConfirm={async () => {
        if (!document) return { ok: false, error: "This document has already been deleted." };
        const result = await deleteDocument(document.id);
        if (!result.ok) return result;
        onDeleted(result.value);
        return { ok: true };
      }}
    />
  );
}
