"use client";

import { useActionState } from "react";
import { Field, FormMessage, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { moveAction } from "../../actions";

export function MoveForm({
  businessId,
  appointmentId,
  staff,
  defaults,
}: {
  businessId: string;
  appointmentId: string;
  staff: { id: string; name: string }[];
  defaults: { staffId: string; date: string; time: string };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(moveAction.bind(null, businessId), {});
  return (
    <form action={formAction} noValidate className="rounded-card bg-card p-5 lift">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <SelectField
        id="staffId"
        name="staffId"
        label="With"
        defaultValue={valueOf(state.values, "staffId", defaults.staffId)}
        error={state.fieldErrors?.staffId}
      >
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-1 gap-x-3 min-[380px]:grid-cols-2">
        <Field
          id="date"
          name="date"
          type="date"
          label="Date"
          defaultValue={valueOf(state.values, "date", defaults.date)}
          error={state.fieldErrors?.date}
        />
        <Field
          id="time"
          name="time"
          type="time"
          step={300}
          label="Time"
          defaultValue={valueOf(state.values, "time", defaults.time)}
          error={state.fieldErrors?.time}
        />
      </div>
      <label className="mb-4 flex min-h-11 items-center justify-between gap-3 text-body">
        <span>
          Allow outside working hours
          <span className="block text-small text-ink-muted">Bookings can never overlap</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          name="allowOutsideHours"
          defaultChecked={state.values?.allowOutsideHours === "on"}
        />
      </label>
      <SubmitButton pendingLabel="Moving…">Move appointment</SubmitButton>
    </form>
  );
}
