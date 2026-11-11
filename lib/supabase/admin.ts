import "server-only";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Service-role client. Bypasses row level security. Import only from server
 * code. Never expose SUPABASE_SERVICE_ROLE_KEY through a NEXT_PUBLIC variable
 * or a client component.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. See docs/supabase-setup.md.");
  }

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
