import "server-only";
import type { z } from "zod";
import type { Db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import type { staffSchema } from "@/schemas/catalog";
import type { HoursRange } from "@/lib/hours";
import { hhmm } from "@/lib/hours";
import { AppError } from "@/lib/errors";
import { toAppError } from "./errors";

type MemberRole = Database["public"]["Enums"]["member_role"];

export type StaffView = {
  id: string;
  userId: string | null;
  displayName: string;
  roleTitle: string | null;
  bio: string | null;
  photoPath: string | null;
  isActive: boolean;
  acceptsOnlineBookings: boolean;
  usesBusinessHours: boolean;
  serviceIds: string[];
  hours: HoursRange[];
  pendingInvite: { phone: string; role: MemberRole; expiresAt: string } | null;
};

export type StaffInput = z.infer<typeof staffSchema>;

/** PostgREST returns range columns as text like "[09:00:00,13:00:00)". */
export function parseTimeRange(value: string): { opens: string; closes: string } | null {
  const match = /^[[(]"?(\d{2}:\d{2})(?::\d{2})?"?,"?(\d{2}:\d{2})(?::\d{2})?"?[)\]]$/.exec(value);
  return match ? { opens: hhmm(match[1]), closes: hhmm(match[2]) } : null;
}

export function toHours(rows: { weekday: number; during: unknown }[]): HoursRange[] {
  return rows.flatMap((row) => {
    const range = typeof row.during === "string" ? parseTimeRange(row.during) : null;
    return range ? [{ weekday: row.weekday, ...range }] : [];
  });
}

export async function listStaff(
  db: Db,
  businessId: string,
  { withInvites }: { withInvites: boolean },
): Promise<StaffView[]> {
  const { data, error } = await db
    .from("staff")
    .select(
      "id, user_id, display_name, role_title, bio, photo_path, is_active, accepts_online_bookings, uses_business_hours, sort_order, staff_services ( service_id ), staff_working_hours ( weekday, during )",
    )
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("sort_order")
    .order("display_name");
  if (error) throw toAppError(error);

  let invites: { staff_id: string; phone_e164: string; role: MemberRole; expires_at: string }[] = [];
  if (withInvites) {
    const result = await db
      .from("staff_invites")
      .select("staff_id, phone_e164, role, expires_at")
      .eq("business_id", businessId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());
    if (result.error) throw toAppError(result.error);
    invites = result.data;
  }

  return data.map((s) => {
    const invite = invites.find((i) => i.staff_id === s.id);
    return {
      id: s.id,
      userId: s.user_id,
      displayName: s.display_name,
      roleTitle: s.role_title,
      bio: s.bio,
      photoPath: s.photo_path,
      isActive: s.is_active,
      acceptsOnlineBookings: s.accepts_online_bookings,
      usesBusinessHours: s.uses_business_hours,
      serviceIds: s.staff_services.map((x) => x.service_id),
      hours: toHours(s.staff_working_hours),
      pendingInvite: invite ? { phone: invite.phone_e164, role: invite.role, expiresAt: invite.expires_at } : null,
    };
  });
}

export async function addStaff(db: Db, businessId: string, input: StaffInput): Promise<string> {
  const { count } = await db.from("staff").select("id", { count: "exact", head: true }).eq("business_id", businessId);
  const { data, error } = await db
    .from("staff")
    .insert({
      business_id: businessId,
      display_name: input.displayName,
      role_title: input.roleTitle,
      bio: input.bio,
      accepts_online_bookings: input.acceptsOnlineBookings,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();
  if (error) throw toAppError(error);
  await setStaffServices(db, data.id, input.serviceIds);
  return data.id;
}

export async function updateStaff(db: Db, businessId: string, staffId: string, input: StaffInput): Promise<void> {
  const { data, error } = await db
    .from("staff")
    .update({
      display_name: input.displayName,
      role_title: input.roleTitle,
      bio: input.bio,
      accepts_online_bookings: input.acceptsOnlineBookings,
    })
    .eq("business_id", businessId)
    .eq("id", staffId)
    .is("deleted_at", null)
    .select("id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("NOT_FOUND", "That team member no longer exists.");
  await setStaffServices(db, staffId, input.serviceIds);
}

export async function setStaffServices(db: Db, staffId: string, serviceIds: string[]): Promise<void> {
  const { error } = await db.rpc("set_staff_services", { p_staff_id: staffId, p_service_ids: serviceIds });
  if (error) throw toAppError(error);
}

export async function setStaffHours(
  db: Db,
  staffId: string,
  usesBusinessHours: boolean,
  hours: HoursRange[],
): Promise<void> {
  const { error } = await db.rpc("set_staff_hours", {
    p_staff_id: staffId,
    p_uses_business_hours: usesBusinessHours,
    p_hours: usesBusinessHours ? [] : hours,
  });
  if (error) throw toAppError(error);
}

export async function removeStaff(db: Db, staffId: string): Promise<void> {
  const { error } = await db.rpc("remove_staff_member", { p_staff_id: staffId });
  if (error) throw toAppError(error);
}

/** Returns the one-time token; the caller builds the link. The token is never stored in plain text. */
export async function inviteStaff(
  db: Db,
  staffId: string,
  phoneE164: string,
  role: "staff" | "manager",
): Promise<string> {
  const { data, error } = await db.rpc("invite_staff", { p_staff_id: staffId, p_phone_e164: phoneE164, p_role: role });
  if (error) throw toAppError(error);
  return data;
}

export async function revokeInvite(db: Db, staffId: string): Promise<void> {
  const { error } = await db.rpc("revoke_staff_invite", { p_staff_id: staffId });
  if (error) throw toAppError(error);
}

export type InvitePreview = {
  businessName: string;
  staffName: string;
  role: MemberRole;
  phoneHint: string;
  status: "valid" | "expired" | "used" | "revoked" | "wrong_phone";
};

export async function getInvite(db: Db, token: string): Promise<InvitePreview | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data, error } = await db.rpc("get_staff_invite", { p_token: token }).maybeSingle();
  if (error) {
    if (error.code === "BZ404") return null;
    throw toAppError(error);
  }
  if (!data) return null;
  return {
    businessName: data.business_name,
    staffName: data.staff_name,
    role: data.role,
    phoneHint: data.phone_hint,
    status: data.status as InvitePreview["status"],
  };
}

export async function acceptInvite(db: Db, token: string): Promise<string> {
  const { data, error } = await db.rpc("accept_staff_invite", { p_token: token });
  if (error) throw toAppError(error);
  return data;
}
