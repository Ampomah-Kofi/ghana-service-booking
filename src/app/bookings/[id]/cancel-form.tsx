"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { cancelBookingAction } from "../actions";

/**
 * Cancelling asks once more in a bottom sheet that says exactly what will happen
 * (docs/design.md: destructive actions confirm with a summary, not "Are you sure?").
 */
export function CancelBookingForm({ appointmentId, summary }: { appointmentId: string; summary: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(cancelBookingAction, {});
  const sheetId = "cancel-booking";

  return (
    <>
      <button
        type="button"
        popoverTarget={sheetId}
        className="pressable flex min-h-12 w-full items-center justify-center rounded-full bg-danger/10 px-5 font-semibold text-danger hover:bg-danger/15"
      >
        Cancel booking
      </button>
      <Sheet id={sheetId} title="Cancel this booking?">
        <form action={formAction}>
          <p className="mb-4 text-body text-ink-muted">{summary}</p>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
          <Field
            id="reason"
            name="reason"
            label="Reason (optional)"
            maxLength={200}
            defaultValue={valueOf(state.values, "reason", "")}
            error={state.fieldErrors?.reason}
          />
          <div className="mt-2 grid gap-2">
            <SubmitButton pendingLabel="Cancelling…" className="bg-danger! hover:bg-danger!">
              Yes, cancel it
            </SubmitButton>
            <button
              type="button"
              popoverTarget={sheetId}
              popoverTargetAction="hide"
              className="flex min-h-12 items-center justify-center rounded-full font-semibold text-primary"
            >
              Keep my booking
            </button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
