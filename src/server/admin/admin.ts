import "server-only";
import { z } from "zod";
import { toAppError } from "@/server/businesses/errors";
import type { Db } from "@/server/db/client";
import { nullableArg } from "@/server/db/client";
import type { Database } from "@/server/db/types";

/**
 * Platform admin reads and changes (Phase 10). Everything goes through admin_* database functions,
 * which check the admin role; changes need a reason and are written to admin_actions.
 */
export type AdminRole = Database["public"]["Enums"]["admin_role"];
export type BusinessStatus = Database["public"]["Enums"]["business_status"];

/** Who may suspend and restore (support is read-only here). */
export const CAN_SUSPEND: readonly AdminRole[] = ["super_admin", "moderator"];

export async function getAdminRole(db: Db, userId: string): Promise<AdminRole | null> {
  const { data, error } = await db.from("platform_admins").select("role").eq("user_id", userId).maybeSingle();
  if (error) throw toAppError(error);
  return data?.role ?? null;
}

const count = z.coerce.number().int().catch(0);
const statsSchema = z.object({
  users: count,
  users_new_7d: count,
  users_suspended: count,
  businesses: z.record(z.string(), count).nullable().catch({}),
  businesses_new_7d: count,
  bookings_7d: count,
  bookings_30d: count,
  visits_30d: z.record(z.string(), count).nullable().catch({}),
  verification_pending: count,
  review_reports_open: count,
  reviews_30d: count,
});
export type PlatformStats = z.infer<typeof statsSchema>;

export async function getPlatformStats(db: Db): Promise<PlatformStats> {
  const { data, error } = await db.rpc("admin_platform_stats");
  if (error) throw toAppError(error);
  return statsSchema.parse(data);
}

export type AdminBusinessRow = {
  id: string;
  name: string;
  slug: string;
  status: BusinessStatus;
  verificationStatus: Database["public"]["Enums"]["business_verification"];
  place: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  bookings30d: number;
  createdAt: string;
};

export async function listBusinesses(
  db: Db,
  query: string | null,
  status: BusinessStatus | null,
): Promise<AdminBusinessRow[]> {
  const { data, error } = await db.rpc("admin_list_businesses", {
    p_query: nullableArg(query),
    p_status: nullableArg(status),
    p_limit: 100,
  });
  if (error) throw toAppError(error);
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    verificationStatus: r.verification_status,
    place: r.place,
    ownerName: r.owner_name,
    ownerPhone: r.owner_phone,
    bookings30d: Number(r.bookings_30d),
    createdAt: r.created_at,
  }));
}

const businessDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  kind: z.string(),
  status: z.enum(["draft", "published", "suspended", "deactivated"]),
  verification_status: z.string(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  created_at: z.string(),
  published_at: z.string().nullable(),
  rating_avg: z.coerce.number().nullable(),
  rating_count: count,
  owners: z.array(z.object({ id: z.string(), name: z.string(), phone: z.string().nullable(), suspended: z.boolean() })),
  team_size: count,
  services: count,
  bookings_30d: count,
  bookings_total: count,
  open_reports: count,
});
export type AdminBusinessDetail = z.infer<typeof businessDetailSchema>;

export async function getBusiness(db: Db, id: string): Promise<AdminBusinessDetail | null> {
  const { data, error } = await db.rpc("admin_get_business", { p_business_id: id });
  if (error) {
    if (error.code === "BZ404") return null;
    throw toAppError(error);
  }
  return businessDetailSchema.parse(data);
}

export type AdminUserRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  suspendedAt: string | null;
  businessesOwned: number;
  bookings: number;
  adminRole: AdminRole | null;
};

export async function listUsers(db: Db, query: string | null): Promise<AdminUserRow[]> {
  const { data, error } = await db.rpc("admin_list_users", { p_query: nullableArg(query), p_limit: 100 });
  if (error) throw toAppError(error);
  return data.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    phone: r.phone_e164,
    email: r.email,
    createdAt: r.created_at,
    suspendedAt: r.suspended_at,
    businessesOwned: Number(r.businesses_owned),
    bookings: Number(r.bookings),
    adminRole: r.admin_role,
  }));
}

const userDetailSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  created_at: z.string(),
  suspended_at: z.string().nullable(),
  suspension_reason: z.string().nullable(),
  admin_role: z.enum(["super_admin", "moderator", "support"]).nullable(),
  businesses: z.array(z.object({ id: z.string(), name: z.string(), role: z.string(), status: z.string() })),
  bookings: count,
  cancelled: count,
  no_shows: count,
  reviews: count,
  reports_made: count,
});
export type AdminUserDetail = z.infer<typeof userDetailSchema>;

export async function getUser(db: Db, id: string): Promise<AdminUserDetail | null> {
  const { data, error } = await db.rpc("admin_get_user", { p_user_id: id });
  if (error) {
    if (error.code === "BZ404") return null;
    throw toAppError(error);
  }
  return userDetailSchema.parse(data);
}

export async function setBusinessSuspended(
  db: Db,
  id: string,
  suspended: boolean,
  reason: string,
): Promise<BusinessStatus> {
  const { data, error } = await db.rpc("admin_set_business_suspended", {
    p_business_id: id,
    p_suspended: suspended,
    p_reason: reason,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function setUserSuspended(db: Db, id: string, suspended: boolean, reason: string): Promise<void> {
  const { error } = await db.rpc("admin_set_user_suspended", {
    p_user_id: id,
    p_suspended: suspended,
    p_reason: reason,
  });
  if (error) throw toAppError(error);
}

export type AuditEntry = {
  id: number;
  adminName: string;
  action: string;
  targetTable: string;
  targetId: string;
  reason: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};

/** admin_actions is readable by admins only (RLS). */
export async function listAudit(
  db: Db,
  filter: { targetId?: string; action?: string } = {},
  limit = 100,
): Promise<AuditEntry[]> {
  let q = db
    .from("admin_actions")
    .select("id, admin_user_id, action, target_table, target_id, reason, before, after, created_at")
    .order("id", { ascending: false })
    .limit(limit);
  if (filter.targetId) q = q.eq("target_id", filter.targetId);
  if (filter.action) q = q.like("action", `${filter.action}%`);
  const { data, error } = await q;
  if (error) throw toAppError(error);
  // Admin names: profiles aren't readable across users, so resolve through the admin lookup.
  const ids = [...new Set(data.map((r) => r.admin_user_id))];
  const names = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const u = await getUser(db, id).catch(() => null);
      names.set(id, u?.full_name ?? "Admin");
    }),
  );
  return data.map((r) => ({
    id: r.id,
    adminName: names.get(r.admin_user_id) ?? "Admin",
    action: r.action,
    targetTable: r.target_table,
    targetId: r.target_id,
    reason: r.reason,
    before: r.before,
    after: r.after,
    createdAt: r.created_at,
  }));
}

export const suspendSchema = z.object({
  id: z.uuid(),
  suspend: z.enum(["true", "false"]).transform((v) => v === "true"),
  reason: z.string().trim().min(3, "Give a reason (it goes in the audit log).").max(500),
});
