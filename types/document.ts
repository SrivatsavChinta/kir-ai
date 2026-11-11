export type DocumentCategory =
  | "Rental Agreement"
  | "Tenant ID"
  | "Property Document"
  | "Invoice / Bill"
  | "Maintenance Document"
  | "Other";

/** The one record a document belongs to. */
export type DocumentAssociationType = "property" | "tenant" | "tenancy";

export type DocumentMimeType = "application/pdf" | "image/jpeg" | "image/png";

/**
 * Metadata for a stored file. The file itself lives in document storage under
 * `storagePath`; this record never holds file contents.
 */
export type DocumentRecord = {
  id: string;
  name: string;
  category: DocumentCategory;
  description?: string;
  associationType: DocumentAssociationType;
  /** Id of the property, tenant or tenancy named by `associationType`. */
  associatedRecordId: string;
  originalFileName: string;
  mimeType: DocumentMimeType;
  /** Bytes. */
  fileSize: number;
  /** ISO timestamp of the latest file upload, including replacements. */
  uploadedAt: string;
  /** Key of the file in document storage. */
  storagePath: string;
};

export type DocumentInput = Pick<
  DocumentRecord,
  "name" | "category" | "description" | "associationType" | "associatedRecordId"
>;
