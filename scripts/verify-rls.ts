import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.log(
    "SKIP RLS: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to run this against a real project.",
  );
  process.exit(0);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function asUser(accessToken: string): SupabaseClient {
  return createClient(url!, anonKey!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const stamp = Date.now().toString(36);
const password = `Rls-test-${stamp}!`;
const emails = [`rls-a-${stamp}@example.com`, `rls-b-${stamp}@example.com`];
const created: string[] = [];

async function signIn(email: string): Promise<{ id: string; token: string }> {
  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new Error(error?.message ?? "sign in failed");
  return { id: data.user.id, token: data.session.access_token };
}

async function main() {
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "RLS Test" },
    });
    if (error || !data.user) throw new Error(error?.message ?? "could not create test user");
    created.push(data.user.id);
  }

  const landlordA = await signIn(emails[0]!);
  const landlordB = await signIn(emails[1]!);
  const clientA = asUser(landlordA.token);
  const clientB = asUser(landlordB.token);

  const { data: property, error: insertError } = await clientA
    .from("properties")
    .insert({
      landlord_id: landlordA.id,
      name: "RLS House",
      property_type: "Villa",
      address: "1 Test Lane",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      description: "Temporary row for the RLS check.",
    })
    .select("id")
    .single();
  if (insertError || !property) throw new Error(insertError?.message ?? "landlord A could not insert");

  const { data: visibleToB, error: readError } = await clientB
    .from("properties")
    .select("id")
    .eq("id", property.id);
  if (readError) throw new Error(readError.message);
  if (visibleToB && visibleToB.length > 0) {
    throw new Error("landlord B can read landlord A's property");
  }

  const { data: stolen, error: updateError } = await clientB
    .from("properties")
    .update({ name: "Stolen" })
    .eq("id", property.id)
    .select("id");
  if (updateError) throw new Error(updateError.message);
  if (stolen && stolen.length > 0) throw new Error("landlord B can update landlord A's property");

  const { data: removed, error: deleteError } = await clientB
    .from("properties")
    .delete()
    .eq("id", property.id)
    .select("id");
  if (deleteError) throw new Error(deleteError.message);
  if (removed && removed.length > 0) throw new Error("landlord B can delete landlord A's property");

  const { error: impersonateError } = await clientB.from("properties").insert({
    landlord_id: landlordA.id,
    name: "Impersonated",
    property_type: "Villa",
    address: "2 Test Lane",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    description: "",
  });
  if (!impersonateError) throw new Error("landlord B inserted a row owned by landlord A");

  const { error: crossReferenceError } = await clientB.from("rental_units").insert({
    landlord_id: landlordB.id,
    property_id: property.id,
    unit_number: "Z-1",
    monthly_rent: 1000,
    status: "Vacant",
  });
  if (!crossReferenceError) {
    throw new Error("landlord B attached a unit to landlord A's property");
  }

  const { data: own, error: ownError } = await clientA
    .from("properties")
    .select("id")
    .eq("id", property.id);
  if (ownError) throw new Error(ownError.message);
  if (!own || own.length !== 1) throw new Error("landlord A cannot read their own property");

  const { data: unit, error: unitError } = await clientA
    .from("rental_units")
    .insert({
      landlord_id: landlordA.id,
      property_id: property.id,
      unit_number: "A-1",
      monthly_rent: 25000,
      status: "Vacant",
    })
    .select("id")
    .single();
  if (unitError || !unit) throw new Error(unitError?.message ?? "landlord A could not add a unit");

  const { data: tenant, error: tenantError } = await clientA
    .from("tenants")
    .insert({
      landlord_id: landlordA.id,
      full_name: "RLS Tenant",
      phone: "9876543210",
      email: `rls-tenant-${stamp}@example.com`,
    })
    .select("id")
    .single();
  if (tenantError || !tenant) throw new Error(tenantError?.message ?? "landlord A could not add a tenant");

  const { data: tenancy, error: tenancyError } = await clientA
    .from("tenancies")
    .insert({
      landlord_id: landlordA.id,
      tenant_id: tenant.id,
      unit_id: unit.id,
      monthly_rent: 25000,
      security_deposit: 50000,
      rent_due_day: 5,
      move_in_date: "2026-09-01",
      agreement_start_date: "2026-09-01",
      agreement_end_date: "2027-08-31",
      status: "Active",
    })
    .select("id")
    .single();
  if (tenancyError || !tenancy) throw new Error(tenancyError?.message ?? "landlord A could not add a tenancy");

  const { data: obligation, error: obligationError } = await clientA
    .from("rent_obligations")
    .insert({
      landlord_id: landlordA.id,
      tenancy_id: tenancy.id,
      billing_month: "2026-09",
      due_date: "2026-09-05",
      expected_amount: 25000,
    })
    .select("id")
    .single();
  if (obligationError || !obligation) {
    throw new Error(obligationError?.message ?? "landlord A could not add an obligation");
  }

  const { data: payment, error: paymentError } = await clientA
    .from("payments")
    .insert({
      landlord_id: landlordA.id,
      tenancy_id: tenancy.id,
      obligation_id: obligation.id,
      amount: 10000,
      payment_date: "2026-09-05",
      payment_method: "UPI",
    })
    .select("id")
    .single();
  if (paymentError || !payment) throw new Error(paymentError?.message ?? "landlord A could not record a payment");

  const documentId = crypto.randomUUID();
  const storagePath = `${landlordA.id}/${documentId}/rls.png`;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const { error: uploadError } = await clientA.storage.from("documents").upload(storagePath, png, {
    contentType: "image/png",
    upsert: false,
  });
  if (uploadError) throw new Error(`landlord A could not upload: ${uploadError.message}`);

  const { data: document, error: documentError } = await clientA
    .from("documents")
    .insert({
      id: documentId,
      landlord_id: landlordA.id,
      name: "RLS file",
      category: "Other",
      association_type: "property",
      associated_record_id: property.id,
      original_file_name: "rls.png",
      mime_type: "image/png",
      file_size: png.byteLength,
      storage_path: storagePath,
    })
    .select("id")
    .single();
  if (documentError || !document) throw new Error(documentError?.message ?? "landlord A could not save document metadata");

  const { data: request, error: requestError } = await clientA
    .from("maintenance_requests")
    .insert({
      landlord_id: landlordA.id,
      title: "RLS leak",
      description: "Temporary request.",
      category: "Plumbing",
      priority: "Low",
      status: "Open",
      property_id: property.id,
      unit_id: unit.id,
      tenant_id: tenant.id,
      tenancy_id: tenancy.id,
      reported_at: "2026-11-12",
    })
    .select("id")
    .single();
  if (requestError || !request) throw new Error(requestError?.message ?? "landlord A could not add maintenance");

  async function hidden(label: string, query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
    const { data, error } = await query;
    if (error) throw new Error(`${label}: ${error.message}`);
    if (data && data.length > 0) throw new Error(label);
  }

  await hidden("landlord B can read landlord A's unit", clientB.from("rental_units").select("id").eq("id", unit.id));
  await hidden("landlord B can read landlord A's tenant", clientB.from("tenants").select("id").eq("id", tenant.id));
  await hidden("landlord B can read landlord A's tenancy", clientB.from("tenancies").select("id").eq("id", tenancy.id));
  await hidden("landlord B can read landlord A's payment", clientB.from("payments").select("id").eq("id", payment.id));
  await hidden("landlord B can read landlord A's obligation", clientB.from("rent_obligations").select("id").eq("id", obligation.id));
  await hidden("landlord B can read landlord A's document", clientB.from("documents").select("id").eq("id", document.id));
  await hidden("landlord B can read landlord A's maintenance request", clientB.from("maintenance_requests").select("id").eq("id", request.id));

  const { error: stealPayment } = await clientB.from("payments").insert({
    landlord_id: landlordB.id,
    tenancy_id: tenancy.id,
    obligation_id: obligation.id,
    amount: 1000,
    payment_date: "2026-09-06",
    payment_method: "Cash",
  });
  if (!stealPayment) throw new Error("landlord B recorded a payment against landlord A's tenancy");

  const { data: stolenPayment } = await clientB
    .from("payments")
    .update({ amount: 1 })
    .eq("id", payment.id)
    .select("id");
  if (stolenPayment && stolenPayment.length > 0) throw new Error("landlord B can change landlord A's payment");

  const { error: stealDocument } = await clientB.from("documents").insert({
    landlord_id: landlordB.id,
    name: "Stolen link",
    category: "Other",
    association_type: "property",
    associated_record_id: property.id,
    original_file_name: "stolen.png",
    mime_type: "image/png",
    file_size: png.byteLength,
    storage_path: `${landlordB.id}/${crypto.randomUUID()}/stolen.png`,
  });
  if (!stealDocument) throw new Error("landlord B linked a document to landlord A's property");

  const { data: downloaded, error: downloadError } = await clientB.storage.from("documents").download(storagePath);
  if (!downloadError || downloaded) throw new Error("landlord B can download landlord A's file");

  const { error: crossUpload } = await clientB.storage.from("documents").upload(
    `${landlordA.id}/${crypto.randomUUID()}/intruder.png`,
    png,
    { contentType: "image/png" },
  );
  if (!crossUpload) throw new Error("landlord B uploaded into landlord A's folder");

  const { data: ownFile, error: ownFileError } = await clientA.storage.from("documents").download(storagePath);
  if (ownFileError || !ownFile) throw new Error(ownFileError?.message ?? "landlord A cannot download their own file");

  console.log("RLS passed for properties, units, tenants, tenancies, payments, documents, maintenance and storage.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
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
    for (const id of created) {
      const bucket = admin.storage.from("documents");
      const { data: folders } = await bucket.list(id, { limit: 1000 });
      const paths: string[] = [];
      for (const folder of folders ?? []) {
        const prefix = `${id}/${folder.name}`;
        const { data: files } = await bucket.list(prefix, { limit: 1000 });
        for (const file of files ?? []) {
          if (file.name) paths.push(`${prefix}/${file.name}`);
        }
      }
      if (paths.length > 0) await bucket.remove(paths);
      for (const table of tables) {
        await admin.from(table).delete().eq("landlord_id", id);
      }
      await admin.auth.admin.deleteUser(id);
    }
  });
