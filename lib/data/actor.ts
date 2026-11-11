import { AsyncLocalStorage } from "node:async_hooks";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The signed-in landlord for one server operation.
 * `supabase` is a user-scoped client: PostgREST and Storage see that landlord's
 * JWT, so row level security still applies. Never build this from a tool argument.
 */
export type Actor = {
  supabase: SupabaseClient;
  userId: string;
  email: string;
};

const actors = new AsyncLocalStorage<Actor>();

export function currentActor(): Actor | undefined {
  return actors.getStore();
}

/** Runs `fn` as `actor`. Nested calls see the inner actor. */
export function runAsActor<T>(actor: Actor, fn: () => T): T {
  return actors.run(actor, fn);
}
