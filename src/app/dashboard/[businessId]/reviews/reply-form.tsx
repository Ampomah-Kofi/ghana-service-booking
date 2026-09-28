"use client";

import { useActionState } from "react";
import { replyToReviewAction } from "@/app/reviews/actions";
import { FormMessage } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";

/** "Reply" (or "Edit reply") opens a sheet: one public reply per review. */
export function ReplyForm({
  reviewId,
  authorName,
  current,
}: {
  reviewId: string;
  authorName: string;
  current: string | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(replyToReviewAction, {});
  const sheetId = `reply-${reviewId}`;
  return (
    <>
      {state.ok ? <Toast message={state.notice ?? "Reply posted"} /> : null}
      <button
        type="button"
        popoverTarget={sheetId}
        className="inline-flex min-h-9 items-center rounded-full bg-primary-soft px-3.5 text-small font-semibold text-primary"
      >
        {current ? "Edit reply" : "Reply"}
      </button>
      <Sheet id={sheetId} title={`Reply to ${authorName}`}>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="reviewId" value={reviewId} />
          <FormMessage
            tone="error"
            message={state.fieldErrors?.body ?? (state.fieldErrors ? undefined : state.message)}
          />
          <label htmlFor={`${sheetId}-body`} className="sr-only">
            Your reply
          </label>
          <textarea
            id={`${sheetId}-body`}
            name="body"
            rows={5}
            maxLength={1000}
            required
            defaultValue={valueOf(state.values, "body", current ?? "")}
            placeholder="Thank them, or explain calmly what happened. Everyone can read this."
            className="block w-full rounded-control border border-border bg-card px-3 py-2.5 text-body outline-none focus:border-primary"
          />
          <p className="text-small text-ink-muted">Shown publicly under the review as a reply from your business.</p>
          <SubmitButton pendingLabel="Posting…">{current ? "Save reply" : "Post reply"}</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
