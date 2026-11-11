import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { toCalendarDate } from "@/lib/dates";
import { sampleDashboardRecords } from "@/lib/mock-data/dashboard";
import { sampleDocuments } from "@/lib/mock-data/documents";
import {
  sampleMaintenanceEvents,
  sampleMaintenanceRequests,
  sampleVendors,
} from "@/lib/mock-data/maintenance";
import { samplePayments } from "@/lib/mock-data/payments";
import { sampleProperties, sampleUnits } from "@/lib/mock-data/properties";
import { sampleTenancies } from "@/lib/mock-data/tenancies";
import { sampleTenants } from "@/lib/mock-data/tenants";
import { generateRentObligations } from "@/lib/rent-calculations";
import { sampleUser } from "@/lib/sample-user";
import { demoId } from "@/lib/supabase/demo-ids";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEMO_LANDLORD_EMAIL ?? sampleUser.email;
const password = process.env.DEMO_LANDLORD_PASSWORD;

if (!url || !serviceRoleKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before seeding.",
  );
  process.exit(1);
}

if (!password) {
  console.error("Set DEMO_LANDLORD_PASSWORD in .env.local. It is only used to create the demo login.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const today = toCalendarDate(sampleDashboardRecords.asOf);
const listBase = "2026-01-01T09:00:00+05:30";

function offsetTimestamp(base: string, index: number): string {
  return new Date(Date.parse(base) + index * 1000).toISOString();
}

async function wipeStorage(landlordId: string) {
  const bucket = admin.storage.from("documents");
  const { data: folders, error } = await bucket.list(landlordId, { limit: 1000 });
  if (error) throw new Error(`storage: ${error.message}`);
  const paths: string[] = [];
  for (const folder of folders ?? []) {
    const prefix = `${landlordId}/${folder.name}`;
    const { data: files, error: fileError } = await bucket.list(prefix, { limit: 1000 });
    if (fileError) throw new Error(`storage: ${fileError.message}`);
    for (const file of files ?? []) {
      if (file.name) paths.push(`${prefix}/${file.name}`);
    }
  }
  if (paths.length === 0) return;
  const { error: removeError } = await bucket.remove(paths);
  if (removeError) throw new Error(`storage: ${removeError.message}`);
}

async function findUserId(address: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === address.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureDemoUser(): Promise<string> {
  const existing = await findUserId(email);
  if (existing) {
    console.log(`Reusing demo login ${email}. Password was not changed.`);
    return existing;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: sampleUser.fullName, phone: sampleUser.phone },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not create the demo user.");
  }
  console.log(`Created demo login ${email}.`);
  return data.user.id;
}

async function wipe(landlordId: string) {
  await wipeStorage(landlordId);
  const tables = [
    "payments",
    "documents",
    "maintenance_events",
    "rent_obligations",
    "maintenance_requests",
    "tenancies",
    "rental_units",
    "tenants",
    "vendors",
    "properties",
  ];
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("landlord_id", landlordId);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function insert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const { error } = await admin.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function seed(landlordId: string) {
  const { error: profileError } = await admin.from("profiles").upsert({
    id: landlordId,
    full_name: sampleUser.fullName,
    phone: sampleUser.phone,
    portfolio_name: "Sample Portfolio",
  });
  if (profileError) throw new Error(`profiles: ${profileError.message}`);

  await wipe(landlordId);

  await insert(
    "properties",
    sampleProperties.map((property, index) => ({
      id: demoId(property.id),
      landlord_id: landlordId,
      name: property.name,
      property_type: property.propertyType,
      address: property.address,
      city: property.city,
      state: property.state,
      pincode: property.pincode,
      description: property.description,
      created_at: offsetTimestamp(listBase, index),
    })),
  );

  await insert(
    "rental_units",
    sampleUnits.map((unit, index) => ({
      id: demoId(unit.id),
      landlord_id: landlordId,
      property_id: demoId(unit.propertyId),
      unit_number: unit.unitNumber,
      floor: unit.floor ?? null,
      bedrooms: unit.bedrooms ?? null,
      bathrooms: unit.bathrooms ?? null,
      monthly_rent: unit.monthlyRent,
      security_deposit: unit.securityDeposit ?? null,
      status: unit.status,
      created_at: offsetTimestamp(listBase, index),
    })),
  );

  await insert(
    "tenants",
    sampleTenants.map((tenant, index) => ({
      id: demoId(tenant.id),
      landlord_id: landlordId,
      full_name: tenant.fullName,
      phone: tenant.phone,
      email: tenant.email,
      current_address: tenant.currentAddress ?? null,
      emergency_contact_name: tenant.emergencyContact?.name ?? null,
      emergency_contact_phone: tenant.emergencyContact?.phone ?? null,
      created_at: offsetTimestamp(listBase, index),
    })),
  );

  await insert(
    "vendors",
    sampleVendors.map((vendor) => ({
      id: demoId(vendor.id),
      landlord_id: landlordId,
      name: vendor.name,
      service_category: vendor.serviceCategory,
      phone: vendor.phone ?? null,
      email: vendor.email ?? null,
      notes: vendor.notes ?? null,
    })),
  );

  await insert(
    "tenancies",
    sampleTenancies.map((tenancy, index) => ({
      id: demoId(tenancy.id),
      landlord_id: landlordId,
      tenant_id: demoId(tenancy.tenantId),
      unit_id: demoId(tenancy.unitId),
      monthly_rent: tenancy.monthlyRent,
      security_deposit: tenancy.securityDeposit,
      rent_due_day: tenancy.rentDueDay,
      move_in_date: tenancy.moveInDate,
      agreement_start_date: tenancy.agreementStartDate,
      agreement_end_date: tenancy.agreementEndDate,
      status: tenancy.status,
      move_out_date: tenancy.moveOutDate ?? null,
      end_reason: tenancy.endReason ?? null,
      created_at: offsetTimestamp(listBase, index),
    })),
  );

  const obligations = generateRentObligations(sampleTenancies, today);
  const obligationIds = new Set(obligations.map((obligation) => obligation.id));
  for (const payment of samplePayments) {
    if (!payment.obligationId || !obligationIds.has(payment.obligationId)) {
      throw new Error(`Payment ${payment.id} does not match a derived rent obligation.`);
    }
  }

  await insert(
    "rent_obligations",
    obligations.map((obligation) => ({
      id: demoId(obligation.id),
      landlord_id: landlordId,
      tenancy_id: demoId(obligation.tenancyId),
      billing_month: obligation.billingMonth,
      due_date: obligation.dueDate,
      expected_amount: obligation.expectedAmount,
    })),
  );

  await insert(
    "payments",
    samplePayments.map((payment, index) => ({
      id: demoId(payment.id),
      landlord_id: landlordId,
      tenancy_id: demoId(payment.tenancyId),
      obligation_id: payment.obligationId ? demoId(payment.obligationId) : null,
      amount: payment.amount,
      payment_date: payment.paymentDate,
      payment_method: payment.paymentMethod,
      transaction_reference: payment.transactionReference ?? null,
      notes: payment.notes ?? null,
      created_at: offsetTimestamp(`${payment.paymentDate}T12:00:00+05:30`, index),
    })),
  );

  const bucket = admin.storage.from("documents");
  const documentRows = [];
  for (const document of sampleDocuments) {
    const storagePath = `${landlordId}/${demoId(document.id)}/${document.originalFileName}`;
    const filePath = path.join(process.cwd(), "public/sample-documents", document.originalFileName);
    let fileSize = document.fileSize;
    if (document.id !== "doc-water-bill-banjara" && existsSync(filePath)) {
      const bytes = readFileSync(filePath);
      fileSize = bytes.byteLength;
      const { error: uploadError } = await bucket.upload(storagePath, bytes, {
        contentType: document.mimeType,
        upsert: true,
      });
      if (uploadError) throw new Error(`storage ${document.id}: ${uploadError.message}`);
    }
    documentRows.push({
      id: demoId(document.id),
      landlord_id: landlordId,
      name: document.name,
      category: document.category,
      description: document.description ?? null,
      association_type: document.associationType,
      associated_record_id: demoId(document.associatedRecordId),
      original_file_name: document.originalFileName,
      mime_type: document.mimeType,
      file_size: fileSize,
      uploaded_at: document.uploadedAt,
      created_at: document.uploadedAt,
      storage_path: storagePath,
    });
  }

  await insert("documents", documentRows);

  await insert(
    "maintenance_requests",
    sampleMaintenanceRequests.map((request) => ({
      id: demoId(request.id),
      landlord_id: landlordId,
      title: request.title,
      description: request.description,
      category: request.category,
      priority: request.priority,
      status: request.status,
      property_id: demoId(request.propertyId),
      unit_id: request.unitId ? demoId(request.unitId) : null,
      tenant_id: request.tenantId ? demoId(request.tenantId) : null,
      tenancy_id: request.tenancyId ? demoId(request.tenancyId) : null,
      reported_at: request.reportedAt,
      target_resolution_date: request.targetResolutionDate ?? null,
      resolved_at: request.resolvedAt ?? null,
      assigned_vendor_id: request.assignedVendorId ? demoId(request.assignedVendorId) : null,
      created_at: request.createdAt,
      updated_at: request.updatedAt,
    })),
  );

  await insert(
    "maintenance_events",
    sampleMaintenanceEvents.map((event) => ({
      id: demoId(event.id),
      landlord_id: landlordId,
      request_id: demoId(event.requestId),
      event_type: event.eventType,
      description: event.description,
      occurred_at: event.timestamp,
    })),
  );
}

async function main() {
  const landlordId = await ensureDemoUser();
  await seed(landlordId);
  const { count, error } = await admin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("landlord_id", landlordId);
  if (error) throw new Error(error.message);
  console.log(`Demo portfolio ready for ${email}: ${count ?? 0} properties. No other accounts were changed.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
