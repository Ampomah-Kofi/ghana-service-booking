"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";
import type { FormState } from "@/server/actions";
import { choosePaymentAction } from "@/app/bookings/actions";

/** "Change how you'll pay": information for the business, nothing is charged. */
export function ChoosePaymentForm({
  appointmentId,
  accepted,
  current,
}: {
  appointmentId: string;
  accepted: PaymentMethod[];
  current: PaymentMethod;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(choosePaymentAction.bind(null, appointmentId), {});
  return (
    <details className="border-t border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 py-3 text-body font-medium text-primary">
        Change how you&apos;ll pay
      </summary>
      <form action={formAction} className="grid grid-cols-[minmax(0,1fr)] gap-2 px-4 pb-4">
        <FormMessage tone="error" message={state.message} />
        <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-2">
          <legend className="sr-only">How will you pay?</legend>
          {accepted.map((m) => (
            <label
              key={m}
              className="pressable flex min-h-12 cursor-pointer items-center gap-3 rounded-control border-2 border-border px-3 has-checked:border-primary has-checked:bg-primary-soft"
            >
              <input
                type="radio"
                name="method"
                value={m}
                defaultChecked={m === current}
                className="size-5 shrink-0 accent-primary"
              />
              <span className="text-body">{PAYMENT_METHODS[m].label}</span>
            </label>
          ))}
        </fieldset>
        <SubmitButton pendingLabel="Saving…" variant="secondary">
          Save
        </SubmitButton>
      </form>
    </details>
  );
}
