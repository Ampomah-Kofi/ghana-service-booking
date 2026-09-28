"use client";

import { useActionState } from "react";
import { saveReviewAction } from "@/app/reviews/actions";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { StarInput } from "./star-input";

/** "How was it?" — stars and an optional note. Also edits an existing review (14 days). */
export function ReviewForm({
  appointmentId,
  review,
  businessName,
}: {
  appointmentId: string;
  review?: { id: string; rating: number; body: string | null };
  businessName: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveReviewAction, {});
  if (state.ok) return <Toast message={state.notice ?? "Saved"} />;
  const rating = Number(valueOf(state.values, "rating", String(review?.rating ?? 0)));
  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      {review ? <input type="hidden" name="reviewId" value={review.id} /> : null}
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <StarInput defaultValue={rating} error={state.fieldErrors?.rating} />
      <label htmlFor="review-body" className="text-small font-medium">
        Tell others about your visit <span className="font-normal text-ink-muted">(optional)</span>
      </label>
      <textarea
        id="review-body"
        name="body"
        rows={4}
        maxLength={1000}
        defaultValue={valueOf(state.values, "body", review?.body ?? "")}
        placeholder={`What did you like at ${businessName}?`}
        className="block w-full rounded-control border border-border bg-card px-3 py-2.5 text-body outline-none focus:border-primary"
      />
      {state.fieldErrors?.body ? <p className="text-small text-danger">{state.fieldErrors.body}</p> : null}
      <p className="text-small text-ink-muted">
        Shown with your first name and initial. You can change it for 14 days.
      </p>
      <SubmitButton pendingLabel="Posting…">{review ? "Save changes" : "Post review"}</SubmitButton>
    </form>
  );
}
