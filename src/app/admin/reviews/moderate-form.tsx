"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { moderateReviewAction } from "./actions";

/** Keep, hide or remove a reported review, with a reason for the audit log. */
export function ModerateForm({ reviewId }: { reviewId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(moderateReviewAction, {});
  if (state.ok) return <p className="text-small font-medium text-success">{state.notice}</p>;
  return (
    <form action={formAction} className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <FormMessage tone="error" message={state.fieldErrors?.reason ?? state.message} />
      <label htmlFor={`reason-${reviewId}`} className="sr-only">
        Reason for the audit log
      </label>
      <input
        id={`reason-${reviewId}`}
        name="reason"
        placeholder="Reason for the audit log"
        className="block min-h-11 w-full rounded-control border border-border bg-card px-3 text-body outline-none focus:border-primary"
      />
      <div className="grid grid-cols-3 gap-2">
        <SubmitButton name="status" value="published" pendingLabel="…" variant="secondary">
          Keep
        </SubmitButton>
        <SubmitButton name="status" value="hidden" pendingLabel="…" variant="secondary">
          Hide
        </SubmitButton>
        <SubmitButton name="status" value="removed" pendingLabel="…" variant="danger">
          Remove
        </SubmitButton>
      </div>
    </form>
  );
}
