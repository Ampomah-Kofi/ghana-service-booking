"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profileNameSchema } from "@/schemas/reviews";
import { accountDeletionBlocker, deleteMyAccount, updateMyName } from "@/server/account/account";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireUser } from "@/server/auth/session";
import { createUserClient } from "@/server/db/supabase-server";

export async function updateNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileNameSchema.safeParse({ fullName: formData.get("fullName") ?? "" });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const user = await requireUser();
    await updateMyName(await createUserClient(), user.id, parsed.data.fullName);
  } catch (error) {
    return formError(error, formData);
  }
  revalidatePath("/account");
  return { ok: true, notice: "Name saved" };
}

/** Deletes the account (database function, no secret key), then clears the session cookie on this device. */
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("confirm") !== "DELETE") {
    return { fieldErrors: { confirm: "Type DELETE to confirm." }, message: "Type DELETE to confirm." };
  }
  try {
    await requireUser();
    const db = await createUserClient();
    const blocker = await accountDeletionBlocker(db);
    if (blocker) return { message: blocker };
    await deleteMyAccount(db);
    // The sign-in no longer exists; drop this device's session without calling the Auth API.
    await db.auth.signOut({ scope: "local" });
  } catch (error) {
    return formError(error, formData);
  }
  redirect("/?deleted=1");
}
