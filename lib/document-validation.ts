import {
  ALLOWED_FILE_TYPES_LABEL,
  associationExists,
  ASSOCIATION_TYPE_LABELS,
  detectDocumentMimeType,
  DOCUMENT_ASSOCIATION_TYPES,
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_DESCRIPTION_LENGTH,
  MAX_DOCUMENT_FILE_SIZE,
  MAX_DOCUMENT_NAME_LENGTH,
  type PortfolioRecords,
} from "@/lib/documents";
import { formatFileSize } from "@/lib/format";
import { hasErrors, type FieldErrors, type ValidationResult } from "@/lib/validation";
import type {
  DocumentAssociationType,
  DocumentCategory,
  DocumentInput,
  DocumentMimeType,
} from "@/types/document";

export type DocumentFormValues = {
  name: string;
  category: DocumentCategory | "";
  file: File | null;
  associationType: DocumentAssociationType | "";
  associatedRecordId: string;
  description: string;
};

export type ValidatedFile = { file: File; mimeType: DocumentMimeType };

/** Checks a chosen file's type and size. */
export function validateDocumentFile(
  file: File | null,
): { success: true; data: ValidatedFile } | { success: false; error: string } {
  if (!file) return { success: false, error: "Choose a file to upload." };
  const mimeType = detectDocumentMimeType(file.name, file.type);
  if (!mimeType) {
    return {
      success: false,
      error: `"${file.name}" isn't a supported file type. Upload a ${ALLOWED_FILE_TYPES_LABEL} file.`,
    };
  }
  if (file.size === 0) return { success: false, error: "This file is empty. Choose another file." };
  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    const size = formatFileSize(file.size);
    const limit = formatFileSize(MAX_DOCUMENT_FILE_SIZE);
    return {
      success: false,
      error: `This file is larger than ${limit}${size === limit ? "" : ` (${size})`}. Choose a smaller file.`,
    };
  }
  return { success: true, data: { file, mimeType } };
}

export function validateDocumentForm(
  values: DocumentFormValues,
  records: PortfolioRecords,
): ValidationResult<{ input: DocumentInput; file: ValidatedFile }, DocumentFormValues> {
  const errors: FieldErrors<DocumentFormValues> = {};

  const name = values.name.trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Enter a document name.";
  else if (name.length > MAX_DOCUMENT_NAME_LENGTH) {
    errors.name = `Document name must be ${MAX_DOCUMENT_NAME_LENGTH} characters or fewer.`;
  }

  const category = values.category;
  if (!category || !DOCUMENT_CATEGORIES.includes(category)) {
    errors.category = "Select a category.";
  }

  const fileResult = validateDocumentFile(values.file);
  if (!fileResult.success) errors.file = fileResult.error;

  const associationType = values.associationType;
  if (!associationType || !DOCUMENT_ASSOCIATION_TYPES.includes(associationType)) {
    errors.associationType = "Select what this document belongs to.";
  } else {
    const label = ASSOCIATION_TYPE_LABELS[associationType].toLowerCase();
    if (!values.associatedRecordId) {
      errors.associatedRecordId = `Select the ${label} this document belongs to.`;
    } else if (!associationExists(associationType, values.associatedRecordId, records)) {
      errors.associatedRecordId = `That ${label} no longer exists. Select another.`;
    }
  }

  const description = values.description.trim();
  if (description.length > MAX_DOCUMENT_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_DOCUMENT_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  if (hasErrors(errors) || !category || !associationType || !fileResult.success) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      input: {
        name,
        category,
        description: description || undefined,
        associationType,
        associatedRecordId: values.associatedRecordId,
      },
      file: fileResult.data,
    },
  };
}
