"use client";

import { valueOf, checkedOf } from "@/lib/form-values";
import { useActionState } from "react";
import { FormMessage, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { saveBookingRulesAction } from "@/app/dashboard/[businessId]/schedule-actions";

type Values = {
  slotIntervalMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  cancellationWindowHours: number;
  autoConfirm: boolean;
};

const options = (pairs: [number, string][]) =>
  pairs.map(([v, label]) => (
    <option key={v} value={v}>
      {label}
    </option>
  ));

export function BookingRulesForm({ businessId, values }: { businessId: string; values: Values }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveBookingRulesAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="rounded-card bg-card p-5 border border-border">
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="notice" message={state.notice} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <SelectField
        id="slotIntervalMinutes"
        name="slotIntervalMinutes"
        label="Start times every"
        defaultValue={valueOf(state.values, "slotIntervalMinutes", String(values.slotIntervalMinutes))}
        hint="e.g. 15 minutes offers 9:00, 9:15, 9:30…"
        error={e.slotIntervalMinutes}
      >
        {options([
          [5, "5 minutes"],
          [10, "10 minutes"],
          [15, "15 minutes"],
          [20, "20 minutes"],
          [30, "30 minutes"],
          [60, "1 hour"],
        ])}
      </SelectField>
      <SelectField
        id="minNoticeMinutes"
        name="minNoticeMinutes"
        label="Customers must book at least"
        defaultValue={valueOf(state.values, "minNoticeMinutes", String(values.minNoticeMinutes))}
        error={e.minNoticeMinutes}
      >
        {options([
          [0, "No notice needed"],
          [30, "30 minutes ahead"],
          [60, "1 hour ahead"],
          [120, "2 hours ahead"],
          [240, "4 hours ahead"],
          [720, "12 hours ahead"],
          [1440, "1 day ahead"],
          [2880, "2 days ahead"],
        ])}
      </SelectField>
      <SelectField
        id="maxAdvanceDays"
        name="maxAdvanceDays"
        label="Customers can book up to"
        defaultValue={valueOf(state.values, "maxAdvanceDays", String(values.maxAdvanceDays))}
        error={e.maxAdvanceDays}
      >
        {options([
          [7, "1 week ahead"],
          [14, "2 weeks ahead"],
          [30, "30 days ahead"],
          [60, "60 days ahead"],
          [90, "90 days ahead"],
          [180, "6 months ahead"],
          [365, "1 year ahead"],
        ])}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          id="bufferBeforeMinutes"
          name="bufferBeforeMinutes"
          label="Prep time before"
          defaultValue={valueOf(state.values, "bufferBeforeMinutes", String(values.bufferBeforeMinutes))}
          error={e.bufferBeforeMinutes}
        >
          {options([
            [0, "None"],
            [5, "5 min"],
            [10, "10 min"],
            [15, "15 min"],
            [30, "30 min"],
          ])}
        </SelectField>
        <SelectField
          id="bufferAfterMinutes"
          name="bufferAfterMinutes"
          label="Clean-up after"
          defaultValue={valueOf(state.values, "bufferAfterMinutes", String(values.bufferAfterMinutes))}
          error={e.bufferAfterMinutes}
        >
          {options([
            [0, "None"],
            [5, "5 min"],
            [10, "10 min"],
            [15, "15 min"],
            [30, "30 min"],
          ])}
        </SelectField>
      </div>
      <SelectField
        id="cancellationWindowHours"
        name="cancellationWindowHours"
        label="Customers can cancel or reschedule up to"
        defaultValue={valueOf(state.values, "cancellationWindowHours", String(values.cancellationWindowHours))}
        error={e.cancellationWindowHours}
      >
        {options([
          [0, "Any time before"],
          [1, "1 hour before"],
          [2, "2 hours before"],
          [6, "6 hours before"],
          [12, "12 hours before"],
          [24, "24 hours before"],
          [48, "48 hours before"],
        ])}
      </SelectField>
      <label className="mb-5 flex min-h-11 items-center justify-between gap-3 text-body">
        <span>
          Confirm bookings automatically
          <span className="block text-small text-ink-muted">Turn off to approve each booking yourself.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          name="autoConfirm"
          defaultChecked={checkedOf(state.values, "autoConfirm", values.autoConfirm)}
        />
      </label>
      <SubmitButton pendingLabel="Saving…">Save booking rules</SubmitButton>
    </form>
  );
}
