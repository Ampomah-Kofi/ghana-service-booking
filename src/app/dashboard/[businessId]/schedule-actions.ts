"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nextStepHref } from "@/components/ui/step-header";
import { blockedTimeSchema, bookingRulesSchema, weekHoursSchema } from "@/schemas/catalog";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireManagedBusiness } from "@/server/businesses/access";
import { createBlockedTime, deleteBlockedTime, saveBookingRules, setBusinessHours } from "@/server/businesses/schedule";

export async function saveHoursAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = weekHoursSchema.safeParse(formData.get("hours") ?? "");
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the times." };
  let next: string | null = null;
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await setBusinessHours(db, business.id, parsed.data);
    revalidatePath(`/dashboard/${business.id}`, "layout");
    revalidatePath(`/business/${business.slug}`);
    if (formData.get("returnTo") === "setup") next = nextStepHref(business.id, "hours");
  } catch (error) {
    return formError(error, formData);
  }
  if (next) redirect(next);
  return { ok: true, notice: "Opening hours saved." };
}

export async function addBlockedTimeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = blockedTimeSchema.safeParse({
    staffId: formData.get("staffId") ?? "",
    allDay: formData.get("allDay"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime") ?? undefined,
    endDate: formData.get("endDate"),
    endTime: formData.get("endTime") ?? undefined,
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await createBlockedTime(db, business.id, parsed.data);
    revalidatePath(`/dashboard/${business.id}/time-off`);
    return { ok: true, notice: "Time off added." };
  } catch (error) {
    return formError(error, formData);
  }
}

export async function deleteBlockedTimeAction(formData: FormData): Promise<void> {
  const { db, business } = await requireManagedBusiness(formData.get("businessId"));
  await deleteBlockedTime(db, business.id, z.uuid().parse(formData.get("blockId")));
  revalidatePath(`/dashboard/${business.id}/time-off`);
}

export async function saveBookingRulesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = bookingRulesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await saveBookingRules(db, business.id, parsed.data);
    revalidatePath(`/dashboard/${business.id}/settings`);
    return { ok: true, notice: "Booking rules saved." };
  } catch (error) {
    return formError(error, formData);
  }
}
