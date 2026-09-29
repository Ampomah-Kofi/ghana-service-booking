"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PAYMENT_METHOD_KEYS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";
import type { FormState } from "@/server/actions";
import { saveAcceptedMethodsAction } from "@/app/dashboard/[businessId]/payments/actions";

/** Which ways of paying the business takes. Customers see them on the page and pick one when booking. */
export function AcceptedMethodsForm({ businessId, accepted }: { businessId: string; accepted: PaymentMethod[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveAcceptedMethodsAction, {});
  return (
    <form action={formAction} className="rounded-card bg-card lift">
      <input type="hidden" name="businessId" value={businessId} />
      <div className="px-4 pt-3 empty:hidden">
        <FormMessage tone="notice" message={state.notice} />
        <FormMessage tone="error" message={state.ok ? undefined : state.message} />
      </div>
      <fieldset className="ios-list">
        <legend className="sr-only">Ways you accept payment</legend>
        {PAYMENT_METHOD_KEYS.map((m) => (
          <label key={m} className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-body">{PAYMENT_METHODS[m].label}</span>
              <span className="block text-small text-ink-muted">{PAYMENT_METHODS[m].hint}</span>
            </span>
            <input type="checkbox" role="switch" name="methods" value={m} defaultChecked={accepted.includes(m)} />
          </label>
        ))}
      </fieldset>
      <div className="border-t border-border px-4 py-3">
        <SubmitButton pendingLabel="Saving…" variant="secondary">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
