"use client";

import { valueOf, checkedOf, listOf } from "@/lib/form-values";
import { useActionState } from "react";
import { Field, FormMessage, SelectField, TextAreaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DURATION_OPTIONS, formatDuration } from "@/lib/hours";
import type { FormState } from "@/server/actions";
import { saveServiceAction } from "@/app/dashboard/[businessId]/services/actions";

type Props = {
  businessId: string;
  serviceId?: string;
  returnTo: "services" | "setup";
  currencySymbol: string;
  staff: { id: string; name: string }[] | null; // null = solo business (no picker)
  values: {
    name: string;
    description: string;
    price: string;
    priceType: "fixed" | "from";
    durationMinutes: number;
    deposit: string;
    isActive: boolean;
    staffIds: string[];
  };
};

export function ServiceForm({ businessId, serviceId, returnTo, currencySymbol, staff, values }: Props) {
  const [state, formAction] = useActionState<FormState, FormData>(saveServiceAction, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="rounded-card bg-card p-5 border border-border">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {serviceId ? <input type="hidden" name="serviceId" value={serviceId} /> : null}
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />

      <Field
        id="name"
        name="name"
        label="Service name"
        placeholder="e.g. Skin fade"
        maxLength={120}
        defaultValue={valueOf(state.values, "name", values.name)}
        error={e.name}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div>
          <label htmlFor="price" className="mb-1.5 block text-small font-medium">
            Price
          </label>
          <div className="flex min-h-11 items-center rounded-control border border-border bg-card focus-within:border-primary">
            <span className="pl-3 text-body text-ink-muted">{currencySymbol}</span>
            <input
              id="price"
              name="price"
              inputMode="decimal"
              defaultValue={valueOf(state.values, "price", values.price)}
              placeholder="50"
              aria-invalid={e.price ? true : undefined}
              aria-describedby={e.price ? "price-error" : undefined}
              className="min-h-11 w-full min-w-0 bg-transparent px-2 text-body tabular-nums outline-none"
            />
          </div>
          {e.price ? (
            <p id="price-error" role="alert" className="mt-1.5 text-small text-danger">
              {e.price}
            </p>
          ) : null}
        </div>
        <SelectField
          id="priceType"
          name="priceType"
          label="Price is"
          defaultValue={valueOf(state.values, "priceType", values.priceType)}
        >
          <option value="fixed">Exact</option>
          <option value="from">From (starting at)</option>
        </SelectField>
      </div>

      <SelectField
        id="durationMinutes"
        name="durationMinutes"
        label="How long it takes"
        defaultValue={valueOf(state.values, "durationMinutes", String(values.durationMinutes))}
        error={e.durationMinutes}
      >
        {DURATION_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {formatDuration(m)}
          </option>
        ))}
      </SelectField>

      <TextAreaField
        id="description"
        name="description"
        label="Description"
        rows={3}
        maxLength={1000}
        defaultValue={valueOf(state.values, "description", values.description)}
        hint="Optional. What's included, what to bring."
        error={e.description}
      />

      <Field
        id="deposit"
        name="deposit"
        label={`Deposit (${currencySymbol})`}
        inputMode="decimal"
        defaultValue={valueOf(state.values, "deposit", values.deposit)}
        placeholder="No deposit"
        hint="Optional. Deposits start working when online payments launch."
        error={e.deposit}
      />

      {staff ? (
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-small font-medium">Who does this service?</legend>
          <div className="grid gap-1">
            {staff.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-3 text-body">
                <input
                  type="checkbox"
                  name="staffIds"
                  value={s.id}
                  defaultChecked={listOf(state.values, "staffIds", values.staffIds).includes(s.id)}
                  className="size-5 accent-primary"
                />
                {s.name}
              </label>
            ))}
          </div>
          {e.staffIds ? (
            <p role="alert" className="mt-1.5 text-small text-danger">
              {e.staffIds}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <label className="mb-5 flex min-h-11 items-center justify-between gap-3 text-body">
        <span>
          Show on my page
          <span className="block text-small text-ink-muted">Turn off to hide it without deleting it.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          name="isActive"
          defaultChecked={checkedOf(state.values, "isActive", values.isActive)}
        />
      </label>

      <SubmitButton pendingLabel="Saving…">{serviceId ? "Save changes" : "Add service"}</SubmitButton>
    </form>
  );
}
