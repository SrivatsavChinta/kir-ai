import { formatDate } from "@/lib/format";
import type {
  DocumentAssociationType,
  DocumentCategory,
  DocumentMimeType,
  DocumentRecord,
} from "@/types/document";
import type { Property, RentalUnit } from "@/types/property";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";

export const DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  "Rental Agreement",
  "Tenant ID",
  "Property Document",
  "Invoice / Bill",
  "Maintenance Document",
  "Other",
];

export const DOCUMENT_ASSOCIATION_TYPES: readonly DocumentAssociationType[] = [
  "property",
  "tenant",
  "tenancy",
];

export const ASSOCIATION_TYPE_LABELS: Record<DocumentAssociationType, string> = {
  property: "Property",
  tenant: "Tenant",
  tenancy: "Tenancy",
};

export const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_DOCUMENT_NAME_LENGTH = 120;
export const MAX_DOCUMENT_DESCRIPTION_LENGTH = 300;

const FILE_TYPES: Record<DocumentMimeType, { label: string; extensions: string[] }> = {
  "application/pdf": { label: "PDF", extensions: ["pdf"] },
  "image/jpeg": { label: "JPG", extensions: ["jpg", "jpeg"] },
  "image/png": { label: "PNG", extensions: ["png"] },
};

/** Value for a file input's `accept` attribute. */
export const DOCUMENT_FILE_ACCEPT = Object.entries(FILE_TYPES)
  .flatMap(([mime, { extensions }]) => [...extensions.map((ext) => `.${ext}`), mime])
  .join(",");

export const ALLOWED_FILE_TYPES_LABEL = "PDF, JPG or PNG";

export function getFileTypeLabel(mimeType: DocumentMimeType): string {
  return FILE_TYPES[mimeType].label;
}

export function isPreviewableImage(mimeType: DocumentMimeType): boolean {
  return mimeType === "image/jpeg" || mimeType === "image/png";
}

/**
 * The document type of a file, from its extension and the type the browser
 * reports. Null when either one isn't an allowed type or they disagree.
 */
export function detectDocumentMimeType(
  fileName: string,
  reportedType: string,
): DocumentMimeType | null {
  const dot = fileName.lastIndexOf(".");
  const extension = dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
  const match = (Object.keys(FILE_TYPES) as DocumentMimeType[]).find((mime) =>
    FILE_TYPES[mime].extensions.includes(extension),
  );
  if (!match) return null;
  // Some browsers report no type, or older aliases for JPEG.
  const reported =
    reportedType === "image/jpg" || reportedType === "image/pjpeg" ? "image/jpeg" : reportedType;
  return !reported || reported === match ? match : null;
}

/**
 * Object name in the private documents bucket.
 * `{landlordId}/{documentId}/{unique}-{fileName}` so a replacement never
 * overwrites a different document's file.
 */
export function documentObjectPath(landlordId: string, documentId: string, fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
  return `${landlordId}/${documentId}/${crypto.randomUUID()}-${cleaned}`;
}

/** True when the path is exactly this landlord's file for this document. */
export function isOwnDocumentObject(path: string, landlordId: string, documentId: string): boolean {
  if (path.includes("..") || path.includes("\\")) return false;
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === landlordId && parts[1] === documentId && parts[2].length > 0;
}

/** Storage key for a document's file. Each upload gets a fresh key. */
export function buildStoragePath(documentId: string, uploadId: string, fileName: string): string {
  const safeName =
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "") || "file";
  return `documents/${documentId}/${uploadId}-${safeName}`;
}

/** "Lease scan" from "Lease scan.pdf", for suggesting a document name. */
export function nameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
}

export type PortfolioRecords = {
  properties: Property[];
  units: RentalUnit[];
  tenants: Tenant[];
  tenancies: Tenancy[];
};

/**
 * The records a document is linked to. A tenancy document resolves to both its
 * tenant and its unit's property; property and tenant documents resolve to
 * only that record.
 */
export type ResolvedAssociation = {
  type: DocumentAssociationType;
  /** False when the associated record no longer exists. */
  found: boolean;
  property?: Property;
  unit?: RentalUnit;
  tenant?: Tenant;
  tenancy?: Tenancy;
};

export function resolveAssociation(
  document: Pick<DocumentRecord, "associationType" | "associatedRecordId">,
  { properties, units, tenants, tenancies }: PortfolioRecords,
): ResolvedAssociation {
  const id = document.associatedRecordId;
  switch (document.associationType) {
    case "property": {
      const property = properties.find((candidate) => candidate.id === id);
      return { type: "property", found: Boolean(property), property };
    }
    case "tenant": {
      const tenant = tenants.find((candidate) => candidate.id === id);
      return { type: "tenant", found: Boolean(tenant), tenant };
    }
    case "tenancy": {
      const tenancy = tenancies.find((candidate) => candidate.id === id);
      const unit = units.find((candidate) => candidate.id === tenancy?.unitId);
      return {
        type: "tenancy",
        found: Boolean(tenancy),
        tenancy,
        unit,
        property: properties.find((candidate) => candidate.id === unit?.propertyId),
        tenant: tenants.find((candidate) => candidate.id === tenancy?.tenantId),
      };
    }
  }
}

/**
 * Whether a document shows on a property's profile: its own documents and
 * those of tenancies in its units. Tenant documents such as ID proofs stay on
 * the tenant's profile only.
 */
export function isDocumentForProperty(resolved: ResolvedAssociation, propertyId: string): boolean {
  return resolved.property?.id === propertyId;
}

/** Whether a document shows on a tenant's profile: theirs and their tenancies', past ones included. */
export function isDocumentForTenant(resolved: ResolvedAssociation, tenantId: string): boolean {
  return resolved.tenant?.id === tenantId;
}

/** "Lakeview Residency, A-101". */
export function formatTenancyLocation(resolved: ResolvedAssociation): string {
  return `${resolved.property?.name ?? "Unknown property"}, ${resolved.unit?.unitNumber ?? "unknown unit"}`;
}

/** One line naming what a document is linked to. */
export function describeAssociation(resolved: ResolvedAssociation): string {
  if (!resolved.found) return "record no longer exists";
  switch (resolved.type) {
    case "property":
      return resolved.property!.name;
    case "tenant":
      return resolved.tenant!.fullName;
    case "tenancy": {
      const ended = resolved.tenancy?.status === "Ended" ? " (ended)" : "";
      return `${resolved.tenant?.fullName ?? "Unknown tenant"} at ${formatTenancyLocation(resolved)}${ended}`;
    }
  }
}

export type AssociationOptionGroup = {
  label?: string;
  options: { value: string; label: string }[];
};

/** Records a document can be linked to, grouped for a select. */
export function getAssociationOptions(
  type: DocumentAssociationType,
  records: PortfolioRecords,
): AssociationOptionGroup[] {
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

  if (type === "property") {
    return [
      {
        options: records.properties
          .map((property) => ({ value: property.id, label: property.name }))
          .sort(byLabel),
      },
    ];
  }

  if (type === "tenant") {
    const activeTenantIds = new Set(
      records.tenancies
        .filter((tenancy) => tenancy.status === "Active")
        .map((tenancy) => tenancy.tenantId),
    );
    const options = records.tenants
      .map((tenant) => ({ value: tenant.id, label: tenant.fullName, active: activeTenantIds.has(tenant.id) }))
      .sort(byLabel);
    return [
      { label: "Current tenants", options: options.filter((option) => option.active) },
      { label: "Former tenants", options: options.filter((option) => !option.active) },
    ].filter((group) => group.options.length > 0);
  }

  const options = records.tenancies
    .map((tenancy) => {
      const resolved = resolveAssociation(
        { associationType: "tenancy", associatedRecordId: tenancy.id },
        records,
      );
      const base = `${resolved.tenant?.fullName ?? "Unknown tenant"} · ${formatTenancyLocation(resolved)}`;
      return {
        value: tenancy.id,
        label: tenancy.moveOutDate ? `${base} (ended ${formatDate(tenancy.moveOutDate)})` : base,
        active: tenancy.status === "Active",
      };
    })
    .sort(byLabel);
  return [
    { label: "Active tenancies", options: options.filter((option) => option.active) },
    { label: "Ended tenancies", options: options.filter((option) => !option.active) },
  ].filter((group) => group.options.length > 0);
}

export function associationExists(
  type: DocumentAssociationType,
  id: string,
  records: PortfolioRecords,
): boolean {
  return resolveAssociation({ associationType: type, associatedRecordId: id }, records).found;
}
