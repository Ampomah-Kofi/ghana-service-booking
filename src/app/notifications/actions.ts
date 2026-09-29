"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { messagePreferencesSchema } from "@/schemas/reviews";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireManagedBusiness } from "@/server/businesses/access";
import { requireUser } from "@/server/auth/session";
import { createUserClient } from "@/server/db/supabase-server";
import { markRead, setBusinessBookingSms, setMessagePreferences } from "@/server/notifications/inbox";

/** Called once the inbox has been shown, so unread dots are seen before they clear. */
export async function markAllReadAction(): Promise<void> {
  await requireUser();
  await markRead(await createUserClient());
  revalidatePath("/", "layout");
}

export async function saveMessagePreferencesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = messagePreferencesSchema.safeParse({ text: formData.get("text"), email: formData.get("email") });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const user = await requireUser();
    await setMessagePreferences(await createUserClient(), user.id, parsed.data);
  } catch (error) {
    return formError(error, formData);
  }
  revalidatePath("/account");
  return { ok: true, notice: "Message settings saved" };
}

export async function saveBusinessAlertsAction(formData: FormData): Promise<void> {
  const { db, business } = await requireManagedBusiness(formData.get("businessId"));
  await setBusinessBookingSms(db, business.id, formData.get("sms") === "on");
  revalidatePath(`/dashboard/${business.id}/settings`);
  redirect(`/dashboard/${business.id}/settings?saved=alerts`);
}
