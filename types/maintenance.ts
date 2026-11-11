// Calendar dates are YYYY-MM-DD in IST; timestamps are ISO 8601 strings.

export type MaintenanceCategory =
  | "Plumbing"
  | "Electrical"
  | "Carpentry"
  | "Painting"
  | "Appliance"
  | "Structural"
  | "Pest Control"
  | "Cleaning"
  | "Other";

export type MaintenancePriority = "Low" | "Medium" | "High" | "Urgent";

export type MaintenanceStatus = "Open" | "In Progress" | "On Hold" | "Resolved" | "Closed";

/**
 * An issue at a property. A unit, tenant and tenancy are optional: landlords
 * report issues for vacant units or the whole property. When a tenant is linked,
 * `tenancyId` is the tenancy they held on the reported date, so the link stays
 * meaningful after that tenancy ends.
 */
export type MaintenanceRequest = {
  id: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  tenancyId?: string;
  /** Calendar date the issue was reported. */
  reportedAt: string;
  /** Calendar date. */
  targetResolutionDate?: string;
  /** Timestamp of the latest resolution; cleared if the request is reopened. */
  resolvedAt?: string;
  assignedVendorId?: string;
  createdAt: string;
  updatedAt: string;
};

/** Fields the user edits directly. Status, tenancy and vendor are managed separately. */
export type MaintenanceRequestInput = Pick<
  MaintenanceRequest,
  | "title"
  | "description"
  | "category"
  | "priority"
  | "propertyId"
  | "unitId"
  | "tenantId"
  | "reportedAt"
  | "targetResolutionDate"
>;

export type MaintenanceEventType =
  | "created"
  | "details_updated"
  | "priority_changed"
  | "status_changed"
  | "resolved"
  | "reopened"
  | "closed"
  | "vendor_assigned"
  | "vendor_changed"
  | "vendor_removed"
  | "note_added";

/**
 * One entry in a request's activity history. Events are only ever appended.
 * For `note_added`, `description` is the note itself.
 */
export type MaintenanceEvent = {
  id: string;
  requestId: string;
  eventType: MaintenanceEventType;
  description: string;
  timestamp: string;
};

export type Vendor = {
  id: string;
  name: string;
  serviceCategory: MaintenanceCategory;
  /** Stored as "+91 98450 12345". */
  phone?: string;
  email?: string;
  notes?: string;
};

export type VendorInput = Omit<Vendor, "id">;

/** How a create or edit assigns a vendor: none, an existing one, or a new one. */
export type VendorChoice =
  | { kind: "none" }
  | { kind: "existing"; vendorId: string }
  | { kind: "new"; vendor: VendorInput };
