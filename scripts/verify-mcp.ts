import { createClient } from "@supabase/supabase-js";

import { runAsActor } from "@/lib/data/actor";
import { createProperty, saveProperty } from "@/lib/data/actions/portfolio";
import { readPortfolioSlice } from "@/lib/data/workspace";
import { encryptSecret, randomToken, sha256 } from "@/lib/mcp/crypto";
import { handleMcpRequest } from "@/lib/mcp/handler";
import { createUserClient } from "@/lib/supabase/user";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.log("SKIP MCP live: Supabase URL, anon key and service role key are not set.");
  process.exit(0);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now().toString(36);
const password = `Mcp-test-${stamp}!`;
const emails = [`mcp-a-${stamp}@example.com`, `mcp-b-${stamp}@example.com`];
const created: string[] = [];

async function signIn(email: string) {
  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new Error(error?.message ?? "sign in failed");
  return { id: data.user.id, email: data.user.email ?? email, session: data.session };
}

function rpc(token: string, id: number, name: string, args: Record<string, unknown>) {
  return new Request("https://kirai.example/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
}

async function toolPayload(response: Response) {
  const text = await response.text();
  const type = response.headers.get("content-type") ?? "";
  const json = type.includes("text/event-stream")
    ? JSON.parse(
        text
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .filter(Boolean)
          .at(-1) ?? "{}",
      )
    : JSON.parse(text);
  return json.result as { isError?: boolean; structuredContent?: Record<string, unknown>; content?: { text: string }[] };
}

async function main() {
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "MCP Test" },
    });
    if (error || !data.user) throw new Error(error?.message ?? "could not create test user");
    created.push(data.user.id);
  }

  const landlordA = await signIn(emails[0]!);
  const landlordB = await signIn(emails[1]!);
  const actorA = {
    supabase: createUserClient(landlordA.session.access_token),
    userId: landlordA.id,
    email: landlordA.email,
  };
  const actorB = {
    supabase: createUserClient(landlordB.session.access_token),
    userId: landlordB.id,
    email: landlordB.email,
  };

  const createdProperty = await runAsActor(actorA, () =>
    createProperty({
      name: "MCP Live House",
      propertyType: "Independent House",
      address: "12 Whitefield Main Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560066",
      description: "Temporary MCP row",
    }),
  );
  if (!createdProperty.ok) throw new Error(createdProperty.error);

  const hidden = await runAsActor(actorB, () => readPortfolioSlice(actorB.supabase));
  if (!hidden.ok) throw new Error(hidden.error);
  if (hidden.properties.some((property) => property.id === createdProperty.value.id)) {
    throw new Error("landlord B can read landlord A's MCP property");
  }

  const updated = await runAsActor(actorA, () =>
    saveProperty(createdProperty.value.id, { ...createdProperty.value, city: "Mysuru" }),
  );
  if (!updated.ok) throw new Error(updated.error);
  const visible = await runAsActor(actorA, () => readPortfolioSlice(actorA.supabase));
  if (!visible.ok) throw new Error(visible.error);
  const row = visible.properties.find((property) => property.id === createdProperty.value.id);
  if (row?.city !== "Mysuru") throw new Error("the application read did not see the updated city");
  console.log("MCP data path passed: create, landlord isolation, update, and application read.");

  if (!process.env.MCP_TOKEN_ENCRYPTION_KEY) {
    throw new Error("MCP_TOKEN_ENCRYPTION_KEY is not set, so the OAuth grant could not be tested.");
  }

  const accessToken = randomToken();
  const refreshToken = randomToken();
  const { error: grantError } = await admin.from("oauth_grants").insert({
    client_id: "live-test",
    client_label: "Live test",
    user_id: landlordA.id,
    scope: "portfolio",
    access_token_hash: sha256(accessToken),
    access_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    refresh_token_hash: sha256(refreshToken),
    refresh_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    supabase_refresh_encrypted: encryptSecret(landlordA.session.refresh_token),
    supabase_access_encrypted: encryptSecret(landlordA.session.access_token),
    supabase_access_expires_at: new Date((landlordA.session.expires_at ?? 0) * 1000).toISOString(),
  });
  if (grantError) {
    throw new Error(
      `OAuth tables are not ready (${grantError.message}). Apply supabase/migrations/20261112000300_mcp_oauth.sql.`,
    );
  }

  const listed = await toolPayload(
    await handleMcpRequest(rpc(accessToken, 1, "list_properties", {})),
  );
  if (listed.isError) throw new Error(listed.content?.[0]?.text ?? "list_properties failed");
  const properties = (listed.structuredContent?.properties ?? []) as { id: string; city: string }[];
  if (!properties.some((property) => property.id === createdProperty.value.id && property.city === "Mysuru")) {
    throw new Error("the MCP read did not see the property saved by the application path");
  }

  const otherToken = randomToken();
  const { error: otherGrantError } = await admin.from("oauth_grants").insert({
    client_id: "live-test",
    client_label: "Live test",
    user_id: landlordB.id,
    scope: "portfolio",
    access_token_hash: sha256(otherToken),
    access_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    refresh_token_hash: sha256(randomToken()),
    refresh_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    supabase_refresh_encrypted: encryptSecret(landlordB.session.refresh_token),
    supabase_access_encrypted: encryptSecret(landlordB.session.access_token),
    supabase_access_expires_at: new Date((landlordB.session.expires_at ?? 0) * 1000).toISOString(),
  });
  if (otherGrantError) throw new Error(otherGrantError.message);

  const otherList = await toolPayload(await handleMcpRequest(rpc(otherToken, 2, "list_properties", {})));
  const otherProperties = (otherList.structuredContent?.properties ?? []) as { id: string }[];
  if (otherProperties.some((property) => property.id === createdProperty.value.id)) {
    throw new Error("landlord B's MCP token can read landlord A's property");
  }

  const renamed = await toolPayload(
    await handleMcpRequest(
      rpc(accessToken, 3, "update_property", { propertyId: createdProperty.value.id, name: "MCP Live House Updated" }),
    ),
  );
  if (renamed.isError) throw new Error(renamed.content?.[0]?.text ?? "update_property failed");
  const after = await runAsActor(actorA, () => readPortfolioSlice(actorA.supabase));
  if (!after.ok) throw new Error(after.error);
  if (after.properties.find((property) => property.id === createdProperty.value.id)?.name !== "MCP Live House Updated") {
    throw new Error("the application did not see the MCP update");
  }
  console.log("MCP OAuth path passed: token, list, isolation, update, and application read-back.");
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
      await admin.from("oauth_grants").delete().eq("user_id", id);
      for (const table of tables) {
        await admin.from(table).delete().eq("landlord_id", id);
      }
      await admin.auth.admin.deleteUser(id);
    }
  });
