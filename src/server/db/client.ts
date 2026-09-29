import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * A Supabase client acting as a user. Services take it as a parameter so the
 * same code runs in Server Actions (cookie session), /api/v1 (Bearer token) and
 * integration tests (a signed-in test user). RLS applies in every case.
 */
export type Db = SupabaseClient<Database>;

/**
 * `supabase gen types` types every function argument as non-null, although
 * Postgres accepts NULL (e.g. "no staff member" = whole business). This makes
 * that one deliberate gap explicit instead of scattering casts.
 */
export function nullableArg<T>(value: T | null): T {
  return value as T;
}
