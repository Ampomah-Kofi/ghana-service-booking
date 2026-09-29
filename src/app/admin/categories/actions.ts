"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categoryAdminSchema } from "@/schemas/catalog";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { saveCategory } from "@/server/admin/categories";
import { createUserClient } from "@/server/db/supabase-server";

/** The database checks the admin role and writes the audit log (admin_save_category). */
export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = categoryAdminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const id = z.uuid().safeParse(formData.get("id"));
    await saveCategory(await createUserClient(), id.success ? id.data : null, parsed.data);
    revalidatePath("/admin/categories");
    revalidatePath("/");
    return { ok: true, notice: "Saved and logged." };
  } catch (error) {
    return formError(error, formData);
  }
}
