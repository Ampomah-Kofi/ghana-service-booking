"use client";

import { valueOf } from "@/lib/form-values";
import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, TextAreaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { addBlockedTimeAction } from "@/app/dashboard/[businessId]/schedule-actions";

export function TimeOffForm({
  businessId,
  staff,
  today,
}: {
  businessId: string;
  staff: { id: string; name: string }[] | null;
  today: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(addBlockedTimeAction, {});
  const [allDay, setAllDay] = useState(true);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="rounded-card bg-surface-elevated p-5 shadow-card">
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="notice" message={state.notice} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      {staff ? (
        <SelectField
          id="staffId"
          name="staffId"
          label="Who is away?"
          defaultValue={valueOf(state.values, "staffId", "all")}
          error={e.staffId}
        >
          <option value="all">Whole business (closed)</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      ) : (
        <input type="hidden" name="staffId" value="all" />
      )}
      <label className="mb-4 flex min-h-11 items-center justify-between gap-3 text-body">
        All day
        <input
          type="checkbox"
          role="switch"
          name="allDay"
          checked={allDay}
          onChange={(ev) => setAllDay(ev.target.checked)}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="startDate"
          name="startDate"
          type="date"
          label="From"
          min={today}
          defaultValue={valueOf(state.values, "startDate", today)}
          error={e.startDate}
        />
        {allDay ? null : (
          <Field
            id="startTime"
            name="startTime"
            type="time"
            step={300}
            label="Start time"
            defaultValue={valueOf(state.values, "startTime", "12:00")}
            error={e.startTime}
          />
        )}
        <Field
          id="endDate"
          name="endDate"
          type="date"
          label={allDay ? "Until (including)" : "To"}
          min={today}
          defaultValue={valueOf(state.values, "endDate", today)}
          error={e.endDate}
        />
        {allDay ? null : (
          <Field
            id="endTime"
            name="endTime"
            type="time"
            step={300}
            label="End time"
            defaultValue={valueOf(state.values, "endTime", "14:00")}
            error={e.endTime}
          />
        )}
      </div>
      <TextAreaField
        id="reason"
        name="reason"
        label="Note"
        rows={2}
        maxLength={200}
        hint="Optional. Only your team sees this."
        error={e.reason}
      />
      <SubmitButton pendingLabel="Adding…">Add time off</SubmitButton>
    </form>
  );
}
