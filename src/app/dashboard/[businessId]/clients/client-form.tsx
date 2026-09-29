"use client";

import { useActionState } from "react";
import { Field, FormMessage, TextAreaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { saveClientAction } from "./actions";

export function ClientForm({
  businessId,
  client,
}: {
  businessId: string;
  client: { id: string; name: string; phone: string; notes: string } | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveClientAction.bind(null, businessId), {});
  return (
    <form action={formAction} noValidate className="rounded-card bg-card p-5 lift">
      <input type="hidden" name="clientId" value={client?.id ?? ""} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <FormMessage tone="notice" message={state.notice} />
      <Field
        id="name"
        name="name"
        label="Name"
        maxLength={120}
        defaultValue={valueOf(state.values, "name", client?.name ?? "")}
        error={state.fieldErrors?.name}
      />
      <Field
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        label="Phone"
        placeholder="Optional, e.g. 024 123 4567"
        defaultValue={valueOf(state.values, "phone", client?.phone ?? "")}
        error={state.fieldErrors?.phone}
      />
      <TextAreaField
        id="notes"
        name="notes"
        label="Private notes"
        rows={3}
        maxLength={2000}
        hint="Only your team sees these, e.g. preferred style or allergies."
        defaultValue={valueOf(state.values, "notes", client?.notes ?? "")}
        error={state.fieldErrors?.notes}
      />
      <SubmitButton pendingLabel="Saving…">{client ? "Save client" : "Add client"}</SubmitButton>
    </form>
  );
}
