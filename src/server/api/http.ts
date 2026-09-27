import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { publicEnv } from "@/lib/public-env";
import type { Db } from "@/server/db/client";
import type { Database } from "@/server/db/types";

/**
 * /api/v1 helpers. Callers authenticate with `Authorization: Bearer <Supabase
 * access token>` (mobile apps) or not at all (public reads); either way the
 * client acts as that user or as anon, so RLS applies. No cookies are used,
 * which keeps the API free of CSRF concerns.
 */
export function apiClient(request: Request): Db {
  const env = publicEnv();
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : undefined,
  });
}

/** For endpoints that need a signed-in caller: verifies the Bearer token (JWT signature and expiry). */
export async function apiUser(request: Request): Promise<{ db: Db; userId: string }> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new AppError("UNAUTHENTICATED", "Sign in to continue.");
  const db = apiClient(request);
  const { data, error } = await db.auth.getClaims(token);
  if (error || !data) throw new AppError("UNAUTHENTICATED", "Your session has expired. Sign in again.");
  return { db, userId: data.claims.sub };
}

/** Public, identical-for-everyone responses may be cached briefly by CDNs; personalised ones never. */
export function json<T>(body: T, { status = 200, cacheSeconds = 0, personalised = false } = {}): Response {
  const cache =
    personalised || cacheSeconds === 0
      ? "private, no-store"
      : `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 5}`;
  return Response.json(body, { status, headers: { "Cache-Control": cache } });
}

export function apiError(error: unknown): Response {
  if (error instanceof AppError) {
    return json(
      { error: { code: error.code, message: error.message, ...(error.detail ? { details: error.detail } : {}) } },
      { status: error.status },
    );
  }
  console.error("[api/v1]", error);
  return json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 });
}

export function validationError(error: ZodError): Response {
  return json(
    {
      error: {
        code: "VALIDATION",
        message: "Some parameters are invalid.",
        details: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
    },
    { status: 422 },
  );
}

export function isPersonalised(request: Request): boolean {
  return request.headers.has("authorization");
}
