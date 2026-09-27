"use client";

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
}: {
  slug: string;
  hidden: Hidden;
  defaults: { customerName: string; customerPhone: string };
  summary: BookingSummary;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(bookAction.bind(null, slug), {});
  return (
    <form action={formAction} noValidate>
      <div className="rounded-card border border-border bg-card p-5">
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
