import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Actor } from "@/lib/data/actor";
import { decryptSecret, encryptSecret, sha256 } from "@/lib/mcp/crypto";
import type { GrantRecord, OAuthStore } from "@/lib/mcp/oauth/types";
import { createSupabaseOAuthStore } from "@/lib/mcp/oauth/supabase-store";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";
import { createUserClient } from "@/lib/supabase/user";

const ACCESS_SKEW_MS = 60_000;

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

export async function actorFromAccessToken(token: string, store: OAuthStore = createSupabaseOAuthStore()): Promise<Actor | null> {
  if (!isSupabaseConfigured()) return null;
  const grant = await store.getGrantByAccessHash(sha256(token));
  if (!grant || !grant.accessExpiresAt || Date.parse(grant.accessExpiresAt) <= Date.now()) return null;
  const session = await supabaseAccessFor(store, grant);
  if (!session || session.userId !== grant.userId) return null;
  return session;
}

/**
 * Maps a kir.ai OAuth grant to a short-lived Supabase user session.
 * The Supabase refresh token is encrypted at rest and rotated when used.
 * Portfolio queries then run with that user's JWT, under row level security.
 */
async function supabaseAccessFor(store: OAuthStore, grant: GrantRecord): Promise<Actor | null> {
  if (
    grant.supabaseAccessEncrypted &&
    grant.supabaseAccessExpiresAt &&
    Date.parse(grant.supabaseAccessExpiresAt) > Date.now() + ACCESS_SKEW_MS
  ) {
    const cached = await userClient(decryptSecret(grant.supabaseAccessEncrypted), grant.userId);
    if (cached) return cached;
  }

  let refreshToken: string;
  try {
    refreshToken = decryptSecret(grant.supabaseRefreshEncrypted);
  } catch {
    return null;
  }
  return rotateSupabaseSession(store, grant, refreshToken, 0);
}

async function rotateSupabaseSession(
  store: OAuthStore,
  grant: GrantRecord,
  refreshToken: string,
  attempt: number,
): Promise<Actor | null> {
  const anon = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });
  const session = data.session;
  if (error || !session || session.user.id !== grant.userId) {
    if (attempt >= 1) return null;
    const fresh = await store.getGrant(grant.id);
    if (!fresh || fresh.revokedAt || fresh.supabaseRefreshEncrypted === grant.supabaseRefreshEncrypted) return null;
    if (
      fresh.supabaseAccessEncrypted &&
      fresh.supabaseAccessExpiresAt &&
      Date.parse(fresh.supabaseAccessExpiresAt) > Date.now() + 30_000
    ) {
      return userClient(decryptSecret(fresh.supabaseAccessEncrypted), fresh.userId);
    }
    return rotateSupabaseSession(store, fresh, decryptSecret(fresh.supabaseRefreshEncrypted), attempt + 1);
  }

  const expiresAt = new Date((session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in) * 1000).toISOString();
  await store.saveSupabaseSession(grant.id, grant.supabaseRefreshEncrypted, {
    supabaseRefreshEncrypted: encryptSecret(session.refresh_token),
    supabaseAccessEncrypted: encryptSecret(session.access_token),
    supabaseAccessExpiresAt: expiresAt,
  });
  return userClient(session.access_token, grant.userId);
}

async function userClient(accessToken: string, userId: string): Promise<Actor | null> {
  const supabase = createUserClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user || data.user.id !== userId) return null;
  return { supabase, userId: data.user.id, email: data.user.email ?? "" };
}
