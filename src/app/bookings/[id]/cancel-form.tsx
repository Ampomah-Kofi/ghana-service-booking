"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { cancelBookingAction } from "../actions";

/** Two taps to cancel: a destructive action asks once more (docs/design.md: sheets over modals). */
export function CancelBookingForm({ appointmentId }: { appointmentId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(cancelBookingAction, {});
  const [asking, setAsking] = useState(false);

  if (state.ok) return <FormMessage tone="notice" message={state.notice} />;
  if (!asking) {
    return (
      <Button
        type="button"
        variant="plain"
        onClick={() => setAsking(true)}
        className="w-full rounded-card bg-surface-elevated text-danger shadow-card"
      >
        Cancel booking
      </Button>
    );
  }
  return (
    <form action={formAction} className="rounded-card bg-surface-elevated p-5 shadow-card">
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
      <div className="grid gap-2">
        <SubmitButton pendingLabel="Cancelling…" className="bg-danger! hover:bg-danger!">
          Yes, cancel it
        </SubmitButton>
        <Button type="button" variant="plain" onClick={() => setAsking(false)}>
          Keep my booking
        </Button>
      </div>
    </form>
  );
}
