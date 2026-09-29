import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createUserClient } from "@/server/db/supabase-server";
import { AppError } from "@/lib/errors";
import { safeReturnPath } from "@/lib/safe-return-path";

export type SessionUser = {
  id: string;
  phone: string | null;
  email: string | null;
};

/**
 * The signed-in user, from a VERIFIED access token (getClaims checks the JWT;
 * never trust getSession() on the server). Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const { claims } = data;
  return {
    id: claims.sub,
    phone: typeof claims.phone === "string" && claims.phone !== "" ? `+${claims.phone.replace(/^\+/, "")}` : null,
    email: typeof claims.email === "string" && claims.email !== "" ? claims.email : null,
  };
});

/** For pages: redirects to sign-in (then back) when there is no session. */
export async function requireUserOrRedirect(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(safeReturnPath(returnTo))}`);
  return user;
}

/** For actions and API handlers: throws instead of redirecting. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}
