"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { setBusinessSuspended, setUserSuspended, suspendSchema } from "@/server/admin/admin";
import { createUserClient } from "@/server/db/supabase-server";

/** The database checks the admin role (super_admin or moderator) and writes the audit log. */
export async function suspendBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = suspendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const status = await setBusinessSuspended(
      await createUserClient(),
      parsed.data.id,
      parsed.data.suspend,
      parsed.data.reason,
    );
    revalidatePath(`/admin/businesses/${parsed.data.id}`);
    revalidatePath("/admin/businesses");
    revalidatePath("/");
    return { ok: true, notice: parsed.data.suspend ? "Suspended and logged." : `Restored (${status}) and logged.` };
  } catch (error) {
    return formError(error, formData);
  }
}

export async function suspendUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = suspendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    await setUserSuspended(await createUserClient(), parsed.data.id, parsed.data.suspend, parsed.data.reason);
    revalidatePath(`/admin/users/${parsed.data.id}`);
    revalidatePath("/admin/users");
    return { ok: true, notice: parsed.data.suspend ? "Suspended and logged." : "Restored and logged." };
  } catch (error) {
    return formError(error, formData);
  }
}
