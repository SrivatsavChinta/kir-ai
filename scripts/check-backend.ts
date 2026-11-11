import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { safeNextPath } from "@/lib/auth/redirect";
import { uuidV5 } from "@/lib/supabase/demo-ids";

const root = process.cwd();
const schema = readFileSync(
  path.join(root, "supabase/migrations/20261112000000_initial_schema.sql"),
  "utf8",
);
const storage = readFileSync(
  path.join(root, "supabase/migrations/20261112000100_storage.sql"),
  "utf8",
);
const operations = readFileSync(
  path.join(root, "supabase/migrations/20261112000200_operations.sql"),
  "utf8",
);

const tables = [
  "profiles",
  "properties",
  "rental_units",
  "tenants",
  "tenancies",
  "rent_obligations",
  "payments",
  "documents",
  "vendors",
  "maintenance_requests",
  "maintenance_events",
];

const failures: string[] = [];

function expect(condition: boolean, message: string) {
  if (!condition) failures.push(message);
}

for (const table of tables) {
  expect(schema.includes(`create table public.${table} `), `missing table ${table}`);
  expect(
    schema.includes(`alter table public.${table} enable row level security;`),
    `RLS not enabled on ${table}`,
  );
}

for (const table of tables.filter((name) => name !== "profiles" && name !== "maintenance_events")) {
  for (const action of ["select", "insert", "update", "delete"]) {
    expect(
      schema.includes(`create policy ${table}_${action}_own`),
      `missing ${action} policy on ${table}`,
    );
  }
}

expect(schema.includes("create policy profiles_select_own"), "missing profile select policy");
expect(schema.includes("create policy profiles_update_own"), "missing profile update policy");
expect(!schema.includes("create policy profiles_insert_own"), "profiles should not be client-insertable");
expect(schema.includes("create policy maintenance_events_select_own"), "missing event select policy");
expect(schema.includes("create policy maintenance_events_insert_own"), "missing event insert policy");
expect(
  !schema.includes("create policy maintenance_events_update_own"),
  "maintenance events must not be updatable",
);
expect(schema.includes("auth.uid()"), "policies must use auth.uid()");
expect(schema.includes("landlord_id must be the signed-in landlord"), "missing landlord identity trigger");
expect(storage.includes("documents_storage_select_own"), "missing storage select policy");
expect(storage.includes("public = excluded.public") || storage.includes("false"), "documents bucket must be private");
expect(!storage.includes("public = true"), "documents bucket must not be public");

const rpcs = [
  "end_tenancy",
  "start_tenancy",
  "create_tenant_with_tenancy",
  "move_tenancy",
  "record_payment",
  "change_maintenance_status",
  "insert_maintenance_request",
  "update_maintenance_request",
  "add_maintenance_note",
];
for (const name of rpcs) {
  expect(operations.includes(`function public.${name}`), `missing function ${name}`);
}
expect(operations.includes("security invoker"), "operations must run as the signed-in user");
expect(!operations.includes("security definer"), "operations must not bypass row level security");
expect(!operations.includes("disable row level security"), "operations must not disable row level security");
expect(operations.includes("tenants_landlord_phone_uidx"), "missing unique phone index");
expect(operations.includes("tenants_landlord_email_uidx"), "missing unique email index");
expect(operations.includes("auth.uid()"), "operations must take the landlord from auth.uid()");
expect(
  operations.includes("revoke all on function public.record_payment"),
  "payment function must not be executable by anonymous users",
);

const vector = uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
expect(vector === "2ed6657d-e927-568b-95e1-2665a8aea6a2", `uuid v5 vector mismatch: ${vector}`);
expect(safeNextPath("//evil.example") === "/", "open redirect not rejected");
expect(safeNextPath("https://evil.example") === "/", "absolute url not rejected");
expect(safeNextPath("/properties") === "/properties", "relative path not kept");
expect(
  safeNextPath("/oauth/authorize?redirect_uri=https://claude.ai/api/mcp/auth_callback") ===
    "/oauth/authorize?redirect_uri=https://claude.ai/api/mcp/auth_callback",
  "oauth return path must keep its query",
);

const oauth = readFileSync(path.join(root, "supabase/migrations/20261112000300_mcp_oauth.sql"), "utf8");
for (const table of ["oauth_clients", "oauth_authorization_codes", "oauth_grants"]) {
  expect(oauth.includes(`alter table public.${table} enable row level security`), `RLS not enabled on ${table}`);
  expect(oauth.includes(`revoke all on table public.${table}`), `grants not revoked on ${table}`);
}
expect(!oauth.includes("create policy"), "oauth tables must not be readable by signed-in landlords");

function walk(directory: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(directory)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) entries.push(...walk(full));
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) entries.push(full);
  }
  return entries;
}

for (const file of walk(root)) {
  if (file.includes(`${path.sep}scripts${path.sep}`)) continue;
  if (file.endsWith(`${path.sep}lib${path.sep}supabase${path.sep}admin.ts`)) continue;
  const source = readFileSync(file, "utf8");
  if (source.includes("SUPABASE_SERVICE_ROLE_KEY") || source.includes("SERVICE_ROLE")) {
    failures.push(`service role referenced outside server admin and scripts: ${path.relative(root, file)}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Backend checks passed: schema, RLS policies, operations, UUID v5, redirect guard, service-role isolation.");
