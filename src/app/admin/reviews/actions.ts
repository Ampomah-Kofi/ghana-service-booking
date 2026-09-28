"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { moderationInputSchema } from "@/schemas/reviews";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { createUserClient } from "@/server/db/supabase-server";
import { moderateReview } from "@/server/reviews/reviews";

/** The database checks the moderator role, closes the reports and writes the audit log (admin_moderate_review). */
export async function moderateReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = moderationInputSchema.safeParse({
    status: formData.get("status"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  const reviewId = z.uuid().safeParse(formData.get("reviewId"));
  if (!reviewId.success) return { message: "Something went wrong. Please try again." };
  try {
    await moderateReview(await createUserClient(), reviewId.data, parsed.data.status, parsed.data.reason);
  } catch (error) {
    return formError(error, formData);
  }
  revalidatePath("/admin/reviews");
  revalidatePath("/business/[slug]", "page");
  return { ok: true, notice: "Done and logged." };
}
