"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { statusAction } from "../actions";

type Status = "pending" | "confirmed" | "arrived" | "completed" | "cancelled" | "no_show";

const ACTION: Partial<Record<Status, { label: string; pending: string; hint: string }>> = {
  confirmed: { label: "Confirm booking", pending: "Confirming…", hint: "Let the customer know it's on" },
  arrived: { label: "Mark arrived", pending: "Saving…", hint: "The customer is here" },
  completed: { label: "Complete", pending: "Saving…", hint: "Done and paid" },
  no_show: { label: "Mark no-show", pending: "Saving…", hint: "They didn't come" },
};

/**
 * The appointment's actions, one tap each. Completing a "from" price asks for the final
 * amount; cancelling asks once more in a bottom sheet with a summary and an optional reason.
 */
export function AppointmentActions({
  businessId,
  appointmentId,
  actions,
  undo,
  askFinalPrice,
  currencySymbol,
  cancelSummary,
}: {
  businessId: string;
  appointmentId: string;
  actions: Status[];
  undo: { status: Status; label: string } | null;
  askFinalPrice: boolean;
  currencySymbol: string;
  cancelSummary: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(statusAction.bind(null, businessId), {});
  const main = actions.filter((a) => a !== "cancelled");
  const canCancel = actions.includes("cancelled");

  return (
    <div className="grid gap-2">
      {state.message && !state.fieldErrors ? <FormMessage tone="error" message={state.message} /> : null}
      {main.map((status, i) => {
        const a = ACTION[status];
        if (!a) return null;
        return (
          <form key={status} action={formAction} className="grid gap-2">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <input type="hidden" name="status" value={status} />
            {status === "completed" && askFinalPrice ? (
              <Field
                id="finalPrice"
                name="finalPrice"
                inputMode="decimal"
                label={`Final price (${currencySymbol})`}
                placeholder="Leave empty to keep the listed price"
                defaultValue={valueOf(state.values, "finalPrice", "")}
                error={state.fieldErrors?.finalPrice}
              />
            ) : null}
            <SubmitButton pendingLabel={a.pending} variant={i === 0 ? "primary" : "secondary"}>
              {a.label}
            </SubmitButton>
          </form>
        );
      })}
      {undo ? (
        <form action={formAction}>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="status" value={undo.status} />
          <SubmitButton pendingLabel="Undoing…" variant="secondary">
            {undo.label}
          </SubmitButton>
        </form>
      ) : null}
      {canCancel ? (
        <>
          <Button type="button" variant="danger" popoverTarget="cancel-appointment">
            Cancel appointment
          </Button>
          <Sheet id="cancel-appointment" title={`Cancel ${cancelSummary}?`}>
            <form action={formAction}>
              <input type="hidden" name="appointmentId" value={appointmentId} />
              <input type="hidden" name="status" value="cancelled" />
              <p className="mb-4 text-body text-ink-muted">The time becomes free for others to book.</p>
              <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
              <Field
                id="reason"
                name="reason"
                label="Reason (optional)"
                maxLength={200}
                placeholder="e.g. Customer called to cancel"
                defaultValue={valueOf(state.values, "reason", "")}
                error={state.fieldErrors?.reason}
              />
              <div className="mt-2 grid gap-2">
                <SubmitButton pendingLabel="Cancelling…" className="bg-danger! text-on-primary! hover:bg-danger!">
                  Cancel appointment
                </SubmitButton>
                <Button type="button" variant="plain" popoverTarget="cancel-appointment" popoverTargetAction="hide">
                  Keep it
                </Button>
              </div>
            </form>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}
