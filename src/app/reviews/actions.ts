"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { replyInputSchema, reportInputSchema, reviewInputSchema } from "@/schemas/reviews";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireUser } from "@/server/auth/session";
import { createUserClient } from "@/server/db/supabase-server";
import { replyToReview, reportReview, submitReview, updateReview } from "@/server/reviews/reviews";

const id = z.uuid();

/** Rate a completed visit (or edit your review within 14 days). */
export async function saveReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reviewInputSchema.safeParse({
    rating: formData.get("rating") ?? undefined,
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  const appointmentId = id.safeParse(formData.get("appointmentId"));
  const reviewId = id.safeParse(formData.get("reviewId"));
  if (!appointmentId.success) return { message: "Something went wrong. Please try again." };
  try {
    await requireUser();
    const db = await createUserClient();
    if (reviewId.success) await updateReview(db, reviewId.data, parsed.data);
    else await submitReview(db, appointmentId.data, parsed.data);
  } catch (error) {
    return formError(error, formData);
  }
  revalidatePath(`/bookings/${appointmentId.data}`);
  revalidatePath("/bookings");
  revalidatePath("/business/[slug]", "page");
  return { ok: true, notice: reviewId.success ? "Review updated" : "Thanks for your review" };
}

export async function reportReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reportInputSchema.safeParse({
    reason: formData.get("reason") ?? undefined,
    details: formData.get("details") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  const reviewId = id.safeParse(formData.get("reviewId"));
  if (!reviewId.success) return { message: "Something went wrong. Please try again." };
  try {
    await requireUser();
    await reportReview(await createUserClient(), reviewId.data, parsed.data.reason, parsed.data.details);
  } catch (error) {
    return formError(error, formData);
  }
  return { ok: true, notice: "Thanks. Our team will take a look." };
}

export async function replyToReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = replyInputSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  const reviewId = id.safeParse(formData.get("reviewId"));
  if (!reviewId.success) return { message: "Something went wrong. Please try again." };
  try {
    await requireUser();
    await replyToReview(await createUserClient(), reviewId.data, parsed.data.body);
  } catch (error) {
    return formError(error, formData);
  }
  revalidatePath("/dashboard/[businessId]/reviews", "page");
  revalidatePath("/business/[slug]", "page");
  return { ok: true, notice: "Reply posted" };
}
