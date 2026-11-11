import type { DocumentRecord } from "@/types/document";
import type { MaintenanceEvent, MaintenanceRequest, Vendor } from "@/types/maintenance";
import type { Payment } from "@/types/payment";
import type { Property, RentalUnit } from "@/types/property";
import type { RentObligation } from "@/types/rent-obligation";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";

export type PropertyRow = {
  id: string;
  name: string;
  property_type: Property["propertyType"];
  address: string;
  city: string;
  state: string;
  pincode: string;
  description: string;
  created_at: string;
};

export type UnitRow = {
  id: string;
  property_id: string;
  unit_number: string;
  floor: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  monthly_rent: number;
  security_deposit: number | null;
  status: RentalUnit["status"];
  created_at: string;
};

export type TenantRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  current_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
};

export type TenancyRow = {
  id: string;
  tenant_id: string;
  unit_id: string;
  monthly_rent: number;
  security_deposit: number;
  rent_due_day: number;
  move_in_date: string;
  agreement_start_date: string;
  agreement_end_date: string;
  status: Tenancy["status"];
  move_out_date: string | null;
  end_reason: Tenancy["endReason"] | null;
};

export type ObligationRow = {
  id: string;
  tenancy_id: string;
  billing_month: string;
  due_date: string;
  expected_amount: number;
};

export type PaymentRow = {
  id: string;
  tenancy_id: string;
  obligation_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: Payment["paymentMethod"];
  transaction_reference: string | null;
  notes: string | null;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  name: string;
  category: DocumentRecord["category"];
  description: string | null;
  association_type: DocumentRecord["associationType"];
  associated_record_id: string;
  original_file_name: string;
  mime_type: DocumentRecord["mimeType"];
  file_size: number;
  uploaded_at: string;
  storage_path: string;
};

export type VendorRow = {
  id: string;
  name: string;
  service_category: Vendor["serviceCategory"];
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type MaintenanceRequestRow = {
  id: string;
  title: string;
  description: string;
  category: MaintenanceRequest["category"];
  priority: MaintenanceRequest["priority"];
  status: MaintenanceRequest["status"];
  property_id: string;
  unit_id: string | null;
  tenant_id: string | null;
  tenancy_id: string | null;
  reported_at: string;
  target_resolution_date: string | null;
  resolved_at: string | null;
  assigned_vendor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceEventRow = {
  id: string;
  request_id: string;
  event_type: MaintenanceEvent["eventType"];
  description: string;
  occurred_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  portfolio_name: string;
  date_format: "d MMM yyyy" | "dd/MM/yyyy" | "yyyy-MM-dd";
  timestamp_display: "relative" | "exact";
  dashboard_view: "rent-first" | "attention-first";
  notify_rent_overdue: boolean;
  notify_agreement_ending: boolean;
  notify_maintenance_updates: boolean;
  notify_weekly_summary: boolean;
  updated_at: string;
};

function optional(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

export function mapProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    name: row.name,
    propertyType: row.property_type,
    address: row.address,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    description: row.description,
  };
}

export function mapUnit(row: UnitRow): RentalUnit {
  return {
    id: row.id,
    propertyId: row.property_id,
    unitNumber: row.unit_number,
    floor: row.floor ?? undefined,
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms ?? undefined,
    monthlyRent: row.monthly_rent,
    securityDeposit: row.security_deposit ?? undefined,
    status: row.status,
  };
}

export function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    currentAddress: optional(row.current_address),
    emergencyContact:
      row.emergency_contact_name && row.emergency_contact_phone
        ? { name: row.emergency_contact_name, phone: row.emergency_contact_phone }
        : undefined,
  };
}

export function mapTenancy(row: TenancyRow): Tenancy {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    unitId: row.unit_id,
    monthlyRent: row.monthly_rent,
    securityDeposit: row.security_deposit,
    rentDueDay: row.rent_due_day,
    moveInDate: row.move_in_date,
    agreementStartDate: row.agreement_start_date,
    agreementEndDate: row.agreement_end_date,
    status: row.status,
    moveOutDate: optional(row.move_out_date),
    endReason: row.end_reason ?? undefined,
  };
}

export function mapObligation(row: ObligationRow): RentObligation {
  return {
    id: row.id,
    tenancyId: row.tenancy_id,
    billingMonth: row.billing_month,
    dueDate: row.due_date,
    expectedAmount: row.expected_amount,
  };
}

export function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    tenancyId: row.tenancy_id,
    obligationId: optional(row.obligation_id),
    amount: row.amount,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    transactionReference: optional(row.transaction_reference),
    notes: optional(row.notes),
    recordedAt: row.created_at,
  };
}

export function mapDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: optional(row.description),
    associationType: row.association_type,
    associatedRecordId: row.associated_record_id,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    uploadedAt: row.uploaded_at,
    storagePath: row.storage_path,
  };
}

export function mapVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    name: row.name,
    serviceCategory: row.service_category,
    phone: optional(row.phone),
    email: optional(row.email),
    notes: optional(row.notes),
  };
}

export function mapMaintenanceRequest(row: MaintenanceRequestRow): MaintenanceRequest {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    propertyId: row.property_id,
    unitId: optional(row.unit_id),
    tenantId: optional(row.tenant_id),
    tenancyId: optional(row.tenancy_id),
    reportedAt: row.reported_at,
    targetResolutionDate: optional(row.target_resolution_date),
    resolvedAt: optional(row.resolved_at),
    assignedVendorId: optional(row.assigned_vendor_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMaintenanceEvent(row: MaintenanceEventRow): MaintenanceEvent {
  return {
    id: row.id,
    requestId: row.request_id,
    eventType: row.event_type,
    description: row.description,
    timestamp: row.occurred_at,
  };
}
