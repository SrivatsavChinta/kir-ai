"use server";

import { requireSession } from "@/lib/data/workspace";
import { createSupabaseOAuthStore } from "@/lib/mcp/oauth/supabase-store";
import type { GrantSummary } from "@/lib/mcp/oauth/types";

export async function listClaudeGrants(): Promise<{ ok: true; grants: GrantSummary[] } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!session.ok) return session;
  try {
    const grants = await createSupabaseOAuthStore().listGrants(session.userId);
    return { ok: true, grants };
  } catch (error) {
    console.error("Could not list OAuth grants", error);
    return { ok: false, error: "Connected apps couldn't be loaded. Apply the OAuth migration if you haven't yet." };
  }
}

export async function revokeClaudeGrant(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "That connection doesn't exist." };
  try {
    const revoked = await createSupabaseOAuthStore().revokeGrant(id, session.userId);
    if (!revoked) return { ok: false, error: "That connection has already been removed." };
    return { ok: true };
  } catch (error) {
    console.error("Could not revoke OAuth grant", error);
    return { ok: false, error: "The connection couldn't be removed. Try again." };
  }
}
