import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/server/env";
import type { Database } from "@/server/db/types";

/**
 * PRIVILEGED client using the Supabase SECRET key. It BYPASSES RLS.
 *
 * Allowed callers (enforced by the no-restricted-imports rule in eslint.config.mjs):
 *   - src/app/api/internal/**  (webhooks, auth hooks, jobs; each authenticates its caller first)
 *   - src/server/jobs/**
 * Never import this from components, Server Actions, or /api/v1 handlers.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
