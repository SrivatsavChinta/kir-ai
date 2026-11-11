"use client";

import { useMemo, useRef, useState } from "react";

import { DocumentFileField } from "@/components/documents/document-file-field";
import { useDocuments } from "@/components/documents/documents-provider";
import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { focusFirstInvalid, FormField } from "@/components/form-field";
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
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  validateDocumentFile,
  validateDocumentForm,
  type DocumentFormValues,
} from "@/lib/document-validation";
import {
  ASSOCIATION_TYPE_LABELS,
  DOCUMENT_ASSOCIATION_TYPES,
  DOCUMENT_CATEGORIES,
  getAssociationOptions,
  nameFromFileName,
  resolveAssociation,
  type PortfolioRecords,
} from "@/lib/documents";
import { getCurrentTenancy, getLatestTenancy } from "@/lib/tenants";
import type { FieldErrors } from "@/lib/validation";
import type {
  DocumentAssociationType,
  DocumentCategory,
  DocumentRecord,
} from "@/types/document";

/** The record an upload starts out linked to, e.g. the profile it was started from. */
export type UploadPreset = {
  associationType: DocumentAssociationType;
  associatedRecordId: string;
};

type UploadDocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes whenever the dialog is reopened, so the form starts fresh. */
  formKey: number;
  preset?: UploadPreset;
  onUploaded: (document: DocumentRecord) => void;
};

export function UploadDocumentDialog({
  open,
  onOpenChange,
  formKey,
  preset,
  onUploaded,
}: UploadDocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Link the document to the property, tenant or tenancy it belongs to. PDF, JPG and PNG
            files up to 10 MB are stored privately. All fields are required unless marked optional.
          </DialogDescription>
        </DialogHeader>
        <UploadDocumentForm
          key={formKey}
          preset={preset}
          onUploaded={(document) => {
            onOpenChange(false);
            onUploaded(document);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The record of `type` that relates to the preset: e.g. a tenant's current
 * tenancy, or the property of a tenancy.
 */
function suggestRecordId(
  type: DocumentAssociationType,
  preset: UploadPreset | undefined,
  records: PortfolioRecords,
): string {
  if (!preset) return "";
  if (type === preset.associationType) return preset.associatedRecordId;
  const resolved = resolveAssociation(preset, records);
  const tenantId = resolved.tenant?.id;
  if (type === "tenant") return tenantId ?? "";
  if (type === "tenancy") {
    return tenantId ? (getLatestTenancy(records.tenancies, tenantId)?.id ?? "") : "";
  }
  if (resolved.property) return resolved.property.id;
  const current = tenantId ? getCurrentTenancy(records.tenancies, tenantId) : undefined;
  return records.units.find((unit) => unit.id === current?.unitId)?.propertyId ?? "";
}

type UploadDocumentFormProps = {
  preset?: UploadPreset;
  onUploaded: (document: DocumentRecord) => void;
};

function UploadDocumentForm({ preset, onUploaded }: UploadDocumentFormProps) {
  const { properties, units, tenants, tenancies } = usePortfolio();
  const { uploadDocument } = useDocuments();
  const records = useMemo(
    () => ({ properties, units, tenants, tenancies }),
    [properties, units, tenants, tenancies],
  );
  const formRef = useRef<HTMLFormElement>(null);
  const lock = useSubmitLock();
  const pending = lock.pending;

  const [values, setValues] = useState<DocumentFormValues>({
    name: "",
    category: "",
    file: null,
    associationType: preset?.associationType ?? "",
    associatedRecordId: preset?.associatedRecordId ?? "",
    description: "",
  });
  const [errors, setErrors] = useState<FieldErrors<DocumentFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [suggestedName, setSuggestedName] = useState("");

  const recordGroups = values.associationType
    ? getAssociationOptions(values.associationType, records)
    : [];
  const recordLabel = values.associationType
    ? ASSOCIATION_TYPE_LABELS[values.associationType]
    : "Linked record";

  function update(next: DocumentFormValues) {
    setValues(next);
    setFormError(undefined);
    if (submitted) {
      const result = validateDocumentForm(next, records);
      setErrors(result.success ? {} : result.errors);
    }
  }

  function selectFile(file: File | null) {
    const suggestion = file ? nameFromFileName(file.name) : "";
    const keepName = values.name.trim() !== "" && values.name !== suggestedName;
    setSuggestedName(suggestion);
    const next = { ...values, file, name: keepName ? values.name : suggestion };
    update(next);
    // Report a bad file straight away rather than on submit.
    const checked = validateDocumentFile(file);
    setErrors((current) => ({
      ...current,
      file: file && !checked.success ? checked.error : submitted ? current.file : undefined,
    }));
  }

  function selectAssociationType(associationType: DocumentAssociationType) {
    update({
      ...values,
      associationType,
      associatedRecordId: suggestRecordId(associationType, preset, records),
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    const result = validateDocumentForm(values, records);
    if (!result.success) {
      setErrors(result.errors);
      focusFirstInvalid(formRef.current);
      return;
    }

    if (!lock.acquire()) return;
    const saved = await uploadDocument(result.data.input, result.data.file.file);
    if (!saved.ok) {
      lock.release();
      setFormError(saved.error);
      return;
    }
    onUploaded(saved.value);
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      aria-busy={pending}
      className="space-y-5"
    >
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <DocumentFileField
          id="document-file"
          label="File"
          file={values.file}
          error={errors.file}
          onChange={selectFile}
        />

        <FormField id="document-name" label="Document name" error={errors.name}>
          {(control) => (
            <Input
              {...control}
              value={values.name}
              placeholder="e.g. Rental agreement 2026–27"
              onChange={(event) => update({ ...values, name: event.target.value })}
            />
          )}
        </FormField>

        <FormField id="document-category" label="Category" error={errors.category}>
          {(control) => (
            <NativeSelect
              {...control}
              value={values.category}
              onChange={(event) =>
                update({ ...values, category: event.target.value as DocumentCategory })
              }
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Select a category
              </NativeSelectOption>
              {DOCUMENT_CATEGORIES.map((category) => (
                <NativeSelectOption key={category} value={category}>
                  {category}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
          <FormField
            id="document-association-type"
            label="Belongs to"
            error={errors.associationType}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={values.associationType}
                onChange={(event) =>
                  selectAssociationType(event.target.value as DocumentAssociationType)
                }
                className="w-full"
              >
                <NativeSelectOption value="" disabled>
                  Select
                </NativeSelectOption>
                {DOCUMENT_ASSOCIATION_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {ASSOCIATION_TYPE_LABELS[type]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField
            id="document-association-record"
            label={recordLabel}
            description={
              values.associationType === "tenancy"
                ? "Shown on both the tenant's and the property's profile."
                : undefined
            }
            error={errors.associatedRecordId}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={values.associatedRecordId}
                onChange={(event) =>
                  update({ ...values, associatedRecordId: event.target.value })
                }
                disabled={!values.associationType}
                className="w-full"
              >
                <NativeSelectOption value="" disabled>
                  {values.associationType
                    ? `Select a ${recordLabel.toLowerCase()}`
                    : "Choose what it belongs to first"}
                </NativeSelectOption>
                {recordGroups.map((group) =>
                  group.label ? (
                    <NativeSelectOptGroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <NativeSelectOption key={option.value} value={option.value}>
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ) : (
                    group.options.map((option) => (
                      <NativeSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </NativeSelectOption>
                    ))
                  ),
                )}
              </NativeSelect>
            )}
          </FormField>
        </div>

        <FormField
          id="document-description"
          label="Description"
          optional
          error={errors.description}
        >
          {(control) => (
            <Textarea
              {...control}
              value={values.description}
              rows={2}
              onChange={(event) => update({ ...values, description: event.target.value })}
            />
          )}
        </FormField>
      </fieldset>

      <FormError message={formError} />

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancel
        </DialogClose>
        <SubmitButton pending={pending} pendingLabel="Uploading…">
          Upload document
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
