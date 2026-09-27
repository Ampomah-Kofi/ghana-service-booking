import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "./types";

/**
 * Supabase client acting AS THE SIGNED-IN USER (publishable key + session
 * cookie), so every query goes through RLS (ADR-0001, ADR-0002).
 * Create one per request; never share across requests.
 */
export async function createUserClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. Safe to ignore:
          // src/proxy.ts refreshes the session and writes the cookies on the response.
        }
      },
    },
  });
}

export type UserClient = Awaited<ReturnType<typeof createUserClient>>;
