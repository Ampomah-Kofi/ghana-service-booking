"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, TextAreaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { addAppointmentAction } from "../actions";

type Option = { id: string; name: string; detail: string; staffIds?: string[] };

/**
 * Phone booking or walk-in. Walk-in is the 3-tap path: service → (person) → Start walk-in.
 * Only the people who offer the chosen service are shown.
 */
export function NewAppointmentForm({
  businessId,
  walkIn,
  services,
  staff,
  clients,
  defaults,
}: {
  businessId: string;
  walkIn: boolean;
  services: Option[];
  staff: Option[];
  clients: { id: string; name: string }[];
  defaults: { serviceId: string; staffId: string; date: string; time: string };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(addAppointmentAction.bind(null, businessId), {});
  const [serviceId, setServiceId] = useState(valueOf(state.values, "serviceId", defaults.serviceId));
  const service = services.find((s) => s.id === serviceId);
  const people = staff.filter((p) => !service || service.staffIds?.includes(p.id));
  const [staffId, setStaffId] = useState(valueOf(state.values, "staffId", defaults.staffId));
  const chosenStaff = people.some((p) => p.id === staffId) ? staffId : (people[0]?.id ?? "");
  const [clientMode, setClientMode] = useState<"new" | "existing">("new");

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="walkIn" value={walkIn ? "1" : "0"} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />

      <fieldset>
        <legend className="mb-2 text-heading font-semibold">Service</legend>
        {services.length === 0 ? (
          <p className="text-body text-ink-muted">Add a service first (More → Services).</p>
        ) : (
          <div className="grid gap-2">
            {services.map((s) => (
              <label
                key={s.id}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-control border px-4 py-2.5 transition-colors ${
                  serviceId === s.id ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-fill"
                }`}
              >
                <input
                  type="radio"
                  name="serviceId"
                  value={s.id}
                  checked={serviceId === s.id}
                  onChange={() => setServiceId(s.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                    serviceId === s.id ? "border-primary" : "border-ink-muted"
                  }`}
                >
                  {serviceId === s.id ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium">{s.name}</span>
                  <span className="block text-small text-ink-muted">{s.detail}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {state.fieldErrors?.serviceId ? (
          <p className="mt-1.5 text-small text-danger" role="alert">
            {state.fieldErrors.serviceId}
          </p>
        ) : null}
      </fieldset>

      {people.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-heading font-semibold">With</legend>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <label
                key={p.id}
                className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-body font-medium ${
                  chosenStaff === p.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"
                }`}
              >
                <input
                  type="radio"
                  name="staffId"
                  value={p.id}
                  checked={chosenStaff === p.id}
                  onChange={() => setStaffId(p.id)}
                  className="sr-only"
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="staffId" value={chosenStaff} />
      )}

      {walkIn ? null : (
        <div className="grid grid-cols-2 gap-3">
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
      )}

      <fieldset>
        <legend className="mb-2 text-heading font-semibold">{walkIn ? "Customer (optional)" : "Client"}</legend>
        {!walkIn && clients.length > 0 ? (
          <div className="mb-3 inline-flex rounded-control bg-fill p-0.5" role="group" aria-label="Client type">
            {(["new", "existing"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={clientMode === mode}
                onClick={() => setClientMode(mode)}
                className={`min-h-9 rounded-inner px-4 text-small font-medium ${
                  clientMode === mode ? "bg-card text-ink shadow-pop" : "text-ink-muted"
                }`}
              >
                {mode === "new" ? "New client" : "Existing client"}
              </button>
            ))}
          </div>
        ) : null}
        {clientMode === "existing" ? (
          <div className="mb-4">
            <label htmlFor="clientId" className="mb-1.5 block text-small font-medium">
              Client
            </label>
            <select
              id="clientId"
              name="clientId"
              defaultValue={valueOf(state.values, "clientId", "")}
              className="block min-h-12 w-full rounded-control border border-border bg-card px-3 text-body"
            >
              <option value="">Choose a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <Field
              id="clientName"
              name="clientName"
              label="Name"
              autoComplete="off"
              maxLength={120}
              placeholder={walkIn ? "Optional" : "e.g. Kofi Boadu"}
              defaultValue={valueOf(state.values, "clientName", "")}
              error={state.fieldErrors?.clientName}
            />
            <Field
              id="clientPhone"
              name="clientPhone"
              type="tel"
              inputMode="tel"
              label="Phone"
              placeholder="Optional, e.g. 024 123 4567"
              hint="Saved to your client list. An existing number reuses that client."
              defaultValue={valueOf(state.values, "clientPhone", "")}
              error={state.fieldErrors?.clientPhone}
            />
          </>
        )}
      </fieldset>

      {walkIn ? null : (
        <>
          <TextAreaField
            id="note"
            name="note"
            label="Note"
            rows={2}
            maxLength={500}
            placeholder="Optional"
            defaultValue={valueOf(state.values, "note", "")}
            error={state.fieldErrors?.note}
          />
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-border bg-card px-4 text-body">
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
        </>
      )}

      <div className="sticky above-tabs -mx-4 border-t border-border bg-surface px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <SubmitButton pendingLabel={walkIn ? "Starting…" : "Adding…"} disabled={services.length === 0}>
          {walkIn ? "Start walk-in" : "Add appointment"}
        </SubmitButton>
      </div>
    </form>
  );
}
