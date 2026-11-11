import { createClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Supabase client for one landlord's access token. Queries and storage calls
 * send that JWT, so row level security applies. This is not the service role.
 */
export function createUserClient(accessToken: string) {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
