"use client";

import { useActionState } from "react";
import { reportReviewAction } from "@/app/reviews/actions";
import { FormMessage } from "@/components/ui/field";
import { FlagIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { REPORT_REASONS } from "@/schemas/reviews";
import type { FormState } from "@/server/actions";

/** "Report" link under a review; opens a sheet with reasons. */
export function ReportReview({ reviewId }: { reviewId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(reportReviewAction, {});
  const sheetId = `report-${reviewId}`;
  return (
    <>
      <button
        type="button"
        popoverTarget={sheetId}
        className="inline-flex min-h-9 items-center gap-1 text-caption font-medium text-ink-muted hover:text-ink"
      >
        <FlagIcon className="size-3.5" /> Report
      </button>
      <Sheet id={sheetId} title="Report this review">
        {state.ok ? (
          <p role="status" className="py-4 text-body">
            {state.notice}
          </p>
        ) : (
          <form action={formAction} className="grid gap-3">
            <input type="hidden" name="reviewId" value={reviewId} />
            <FormMessage
              tone="error"
              message={state.fieldErrors?.reason ?? (state.fieldErrors ? undefined : state.message)}
            />
            <fieldset className="ios-list overflow-hidden rounded-card bg-fill">
              <legend className="sr-only">Reason</legend>
              {Object.entries(REPORT_REASONS).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-body"
                >
                  {label}
                  <input type="radio" name="reason" value={value} className="size-5 accent-primary" />
                </label>
              ))}
            </fieldset>
            <label htmlFor={`${sheetId}-details`} className="text-small font-medium">
              Anything else? <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea
              id={`${sheetId}-details`}
              name="details"
              rows={2}
              maxLength={500}
              className="block w-full rounded-control border border-border bg-card px-3 py-2 text-body outline-none focus:border-primary"
            />
            <SubmitButton pendingLabel="Sending…">Send report</SubmitButton>
          </form>
        )}
      </Sheet>
    </>
  );
}
