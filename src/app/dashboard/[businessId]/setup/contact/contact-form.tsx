"use client";

import { valueOf } from "@/lib/form-values";
import { useActionState, useState } from "react";
import { Field, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { saveContactAction } from "../../actions";

type Values = { phone: string; whatsapp: string; email: string; whatsappSame: boolean };

export function ContactForm({ businessId, values }: { businessId: string; values: Values }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveContactAction, {});
  const [same, setSame] = useState(values.whatsappSame);

  return (
    <form action={formAction} noValidate className="rounded-card bg-card p-5 border border-border">
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <Field
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        label="Phone number for customers"
        defaultValue={valueOf(state.values, "phone", values.phone)}
        placeholder="024 123 4567"
        error={state.fieldErrors?.phone}
      />
      <label className="mb-4 flex min-h-11 items-center gap-3 text-body">
        <input
          type="checkbox"
          name="whatsappSameAsPhone"
          checked={same}
          onChange={(e) => setSame(e.target.checked)}
          className="size-5 accent-primary"
        />
        I use this number on WhatsApp
      </label>
      {same ? null : (
        <Field
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          label="WhatsApp number"
          defaultValue={valueOf(state.values, "whatsapp", values.whatsapp)}
          placeholder="Optional"
          error={state.fieldErrors?.whatsapp}
        />
      )}
      <Field
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        label="Email"
        defaultValue={valueOf(state.values, "email", values.email)}
        hint="Optional."
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Saving…">Save and continue</SubmitButton>
    </form>
  );
}
