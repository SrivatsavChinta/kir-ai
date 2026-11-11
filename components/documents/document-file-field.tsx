"use client";

import { FileText } from "lucide-react";

import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import {
  ALLOWED_FILE_TYPES_LABEL,
  DOCUMENT_FILE_ACCEPT,
  getFileTypeLabel,
  MAX_DOCUMENT_FILE_SIZE,
} from "@/lib/documents";
import { validateDocumentFile } from "@/lib/document-validation";
import { formatFileSize } from "@/lib/format";

type DocumentFileFieldProps = {
  id: string;
  label: string;
  file: File | null;
  error?: string;
  onChange: (file: File | null) => void;
};

export function DocumentFileField({ id, label, file, error, onChange }: DocumentFileFieldProps) {
  const checked = file && !error ? validateDocumentFile(file) : null;
  return (
    <FormField
      id={id}
      label={label}
      description={`${ALLOWED_FILE_TYPES_LABEL}, up to ${formatFileSize(MAX_DOCUMENT_FILE_SIZE)}.`}
      error={error}
    >
      {(control) => (
        <>
          <Input
            {...control}
            type="file"
            accept={DOCUMENT_FILE_ACCEPT}
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
            className="h-auto py-1.5"
          />
          {checked?.success && (
            <p className="flex min-w-0 items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block font-medium break-all">{checked.data.file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {getFileTypeLabel(checked.data.mimeType)} · {formatFileSize(file!.size)}
                </span>
              </span>
            </p>
          )}
        </>
      )}
    </FormField>
  );
}
