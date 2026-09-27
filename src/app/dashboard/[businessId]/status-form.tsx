"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { statusAction } from "./appointments/actions";

const LABELS = {
  confirmed: ["Confirm", "Confirming…"],
  arrived: ["Mark arrived", "Saving…"],
  completed: ["Complete", "Saving…"],
  no_show: ["No-show", "Saving…"],
  cancelled: ["Cancel", "Cancelling…"],
  pending: ["Pending", "Saving…"],
} as const;

type Status = keyof typeof LABELS;

/** One-tap status change (e.g. "Mark arrived" on the Up next card). */
export function StatusButton({
  businessId,
  appointmentId,
  status,
  label,
  variant = "primary",
}: {
  businessId: string;
  appointmentId: string;
  status: Status;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction] = useActionState<FormState, FormData>(statusAction.bind(null, businessId), {});
  const [text, pending] = LABELS[status];
  return (
    <form action={formAction} className="min-w-0 flex-1">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton pendingLabel={pending} variant={variant}>
        {label ?? text}
      </SubmitButton>
      {state.message ? (
        <div className="mt-2">
          <FormMessage tone="error" message={state.message} />
        </div>
      ) : null}
    </form>
  );
}
