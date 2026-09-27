import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * A Supabase client acting as a user. Services take it as a parameter so the
 * same code runs in Server Actions (cookie session), /api/v1 (Bearer token) and
 * integration tests (a signed-in test user). RLS applies in every case.
 */
export type Db = SupabaseClient<Database>;
