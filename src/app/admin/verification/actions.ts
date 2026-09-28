"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verificationDecisionSchema } from "@/schemas/verification";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { setVerification } from "@/server/businesses/verification";
import { createUserClient } from "@/server/db/supabase-server";

/** The database checks the admin role and writes the audit log (admin_set_business_verification). */
export async function decideVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = verificationDecisionSchema.safeParse({
    status: formData.get("status"),
    reason: formData.get("reason") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  const businessId = z.uuid().safeParse(formData.get("businessId"));
  if (!businessId.success) return { message: "Something went wrong. Please try again." };
  try {
    await setVerification(
      await createUserClient(),
      businessId.data,
      parsed.data.status,
      parsed.data.reason,
      parsed.data.note,
    );
  } catch (error) {
    return formError(error, formData);
  }
  revalidatePath("/admin/verification");
  revalidatePath("/business/[slug]", "page");
  revalidatePath("/");
  const done = {
    verified: "Verified and logged.",
    declined: "Declined and logged.",
    none: "Check removed and logged.",
  };
  return { ok: true, notice: done[parsed.data.status] };
}
