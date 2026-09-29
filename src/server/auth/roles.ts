import "server-only";
import { z } from "zod";
import { createUserClient } from "@/server/db/supabase-server";
import type { Database } from "@/server/db/types";
import { AppError } from "@/lib/errors";
import { requireUser } from "./session";

export type MemberRole = Database["public"]["Enums"]["member_role"];
export type BusinessStatus = Database["public"]["Enums"]["business_status"];

export const MANAGER_ROLES: readonly MemberRole[] = ["owner", "manager"];
export const ALL_MEMBER_ROLES: readonly MemberRole[] = ["owner", "manager", "staff"];

const businessIdSchema = z.uuid();

/**
 * The caller's role in a business, or null. Uses the user-scoped client, so
 * RLS already limits business_members to the caller's own businesses; the
 * user_id filter just picks the caller's row. The UI is never the authority.
 */
export async function getBusinessRole(businessId: string): Promise<MemberRole | null> {
  const parsed = businessIdSchema.safeParse(businessId);
  if (!parsed.success) return null;
  const user = await requireUser();
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new AppError("INTERNAL", "Could not check your access.");
  return data?.role ?? null;
}

/** Throws FORBIDDEN unless the caller has one of `allowed` in the business. */
export async function requireBusinessRole(businessId: string, allowed: readonly MemberRole[]): Promise<MemberRole> {
  const role = await getBusinessRole(businessId);
  if (!role || !allowed.includes(role)) {
    throw new AppError("FORBIDDEN", "You don't have access to this business.");
  }
  return role;
}

export type Membership = {
  businessId: string;
  role: MemberRole;
  business: { slug: string; name: string; status: BusinessStatus };
};

export async function listMyMemberships(): Promise<Membership[]> {
  const user = await requireUser();
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("business_members")
    .select("business_id, role, businesses!inner(slug, name, status)")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw new AppError("INTERNAL", "Could not load your businesses.");
  return data.map((row) => ({
    businessId: row.business_id,
    role: row.role,
    business: { slug: row.businesses.slug, name: row.businesses.name, status: row.businesses.status },
  }));
}

/** platform_admins is readable only by admins (RLS), so non-admins simply see no row. */
export async function isPlatformAdmin(): Promise<boolean> {
  const user = await requireUser();
  const supabase = await createUserClient();
  const { data, error } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) throw new AppError("INTERNAL", "Could not check admin access.");
  return data !== null;
}
