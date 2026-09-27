"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/public-env";
import { inviteSchema, staffSchema, weekHoursSchema } from "@/schemas/catalog";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireManagedBusiness } from "@/server/businesses/access";
import { addStaff, inviteStaff, removeStaff, revokeInvite, setStaffHours, updateStaff } from "@/server/businesses/team";
import { serverEnv } from "@/server/env";

function refresh(businessId: string, slug: string) {
  revalidatePath(`/dashboard/${businessId}`, "layout");
  revalidatePath(`/business/${slug}`);
}

export async function saveStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = staffSchema.safeParse({
    displayName: formData.get("displayName"),
    roleTitle: formData.get("roleTitle") ?? "",
    bio: formData.get("bio") ?? "",
    acceptsOnlineBookings: formData.get("acceptsOnlineBookings"),
    serviceIds: formData.getAll("serviceIds").map(String),
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  let destination: string;
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    const staffId = z.uuid().safeParse(formData.get("staffId"));
    if (staffId.success) {
      await updateStaff(db, business.id, staffId.data, parsed.data);
      destination = `/dashboard/${business.id}/team`;
    } else {
      const id = await addStaff(db, business.id, parsed.data);
      destination = `/dashboard/${business.id}/team/${id}?added=1`;
    }
    refresh(business.id, business.slug);
  } catch (error) {
    return formError(error, formData);
  }
  redirect(destination);
}

export async function saveStaffHoursAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const usesBusinessHours = formData.get("usesBusinessHours") === "on";
  const hours = usesBusinessHours
    ? { success: true as const, data: [] }
    : weekHoursSchema.safeParse(formData.get("hours") ?? "");
  if (!hours.success) return { message: hours.error.issues[0]?.message ?? "Check the times." };
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await setStaffHours(db, z.uuid().parse(formData.get("staffId")), usesBusinessHours, hours.data);
    refresh(business.id, business.slug);
    return { ok: true, notice: "Working hours saved." };
  } catch (error) {
    return formError(error, formData);
  }
}

export type InviteState = FormState & { link?: string; phone?: string };

export async function inviteStaffAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = inviteSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse({
    phone: formData.get("phone"),
    role: formData.get("role") ?? "staff",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    const token = await inviteStaff(db, z.uuid().parse(formData.get("staffId")), parsed.data.phone, parsed.data.role);
    refresh(business.id, business.slug);
    return { ok: true, link: `${publicEnv().NEXT_PUBLIC_SITE_URL}/invite/${token}`, phone: parsed.data.phone };
  } catch (error) {
    return formError(error, formData);
  }
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const { db, business } = await requireManagedBusiness(formData.get("businessId"));
  await revokeInvite(db, z.uuid().parse(formData.get("staffId")));
  refresh(business.id, business.slug);
}

export async function removeStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let businessId: string;
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await removeStaff(db, z.uuid().parse(formData.get("staffId")));
    refresh(business.id, business.slug);
    businessId = business.id;
  } catch (error) {
    return formError(error, formData);
  }
  redirect(`/dashboard/${businessId}/team`);
}
