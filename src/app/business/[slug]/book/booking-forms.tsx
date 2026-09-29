"use client";

import { BRAND } from "@/lib/brand";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";
import { useActionState } from "react";
import { Field, FormMessage, TextAreaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import { BookingBar, type BookingSummary } from "@/components/booking/booking-bar";
import type { FormState } from "@/server/actions";
import { bookAction, rescheduleAction } from "./actions";

type Hidden = { serviceId: string; staff: string; startsAt: string; idempotencyKey: string };

export function BookingDetailsForm({
  slug,
  hidden,
  defaults,
  summary,
  paymentMethods,
  businessName,
}: {
  slug: string;
  hidden: Hidden;
  defaults: { customerName: string; customerPhone: string };
  summary: BookingSummary;
  /** Ways the business takes payment; the customer says which they'll use (ADR-0017). */
  paymentMethods: PaymentMethod[];
  businessName: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(bookAction.bind(null, slug), {});
  return (
    <form action={formAction} noValidate>
      <div className="rounded-card bg-card p-5 lift">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
        <Field
          id="customerName"
          name="customerName"
          autoComplete="name"
          label="Your name"
          required
          maxLength={120}
          defaultValue={valueOf(state.values, "customerName", defaults.customerName)}
          error={state.fieldErrors?.customerName}
        />
        <Field
          id="customerPhone"
          name="customerPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          label="Phone number"
          placeholder="024 123 4567"
          defaultValue={valueOf(state.values, "customerPhone", defaults.customerPhone)}
          hint="Only this business sees it, so they can reach you about this booking."
          error={state.fieldErrors?.customerPhone}
        />
        <TextAreaField
          id="note"
          name="note"
          label="Note for the business"
          rows={3}
          maxLength={500}
          placeholder="Optional, e.g. hair length or gate colour"
          defaultValue={valueOf(state.values, "note", "")}
          error={state.fieldErrors?.note}
        />
        {paymentMethods.length > 1 ? (
          <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <legend className="mb-1.5 text-small font-medium">How will you pay?</legend>
            {paymentMethods.map((m) => (
              <label
                key={m}
                className="pressable flex min-h-12 cursor-pointer items-center gap-3 rounded-control border-2 border-border px-3 py-2 has-checked:border-primary has-checked:bg-primary-soft"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m}
                  defaultChecked={valueOf(state.values, "paymentMethod", paymentMethods[0]) === m}
                  className="size-5 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-body font-medium">{PAYMENT_METHODS[m].label}</span>
                  <span className="block text-small text-ink-muted">{PAYMENT_METHODS[m].hint}</span>
                </span>
              </label>
            ))}
            <p className="text-small text-ink-muted">
              You pay {businessName} directly. {BRAND.name} never takes payment.
            </p>
          </fieldset>
        ) : (
          <>
            <input type="hidden" name="paymentMethod" value={paymentMethods[0] ?? "cash"} />
            <p className="text-small text-ink-muted">
              Pay {businessName} directly: {PAYMENT_METHODS[paymentMethods[0] ?? "cash"].label.toLowerCase()}.
            </p>
          </>
        )}
        {state.fieldErrors?.startsAt || state.fieldErrors?.idempotencyKey ? (
          <FormMessage tone="error" message="This booking link is incomplete. Please choose your time again." />
        ) : null}
      </div>
      <BookingBar summary={summary}>
        <SubmitButton pendingLabel="Booking…">Confirm booking</SubmitButton>
      </BookingBar>
    </form>
  );
}

export function ConfirmRescheduleForm({
  appointmentId,
  staff,
  startsAt,
  summary,
}: {
  appointmentId: string;
  staff: string;
  startsAt: string;
  summary: BookingSummary;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(rescheduleAction, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="staff" value={staff} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <FormMessage tone="error" message={state.message} />
      <BookingBar summary={summary}>
        <SubmitButton pendingLabel="Moving…">Move booking</SubmitButton>
      </BookingBar>
    </form>
  );
}
