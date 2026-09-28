"use client";

import { valueOf } from "@/lib/form-values";
import { useActionState, useState } from "react";
import { Field, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { saveContactAction } from "../../actions";

type Values = {
  phone: string;
  whatsapp: string;
  email: string;
  whatsappSame: boolean;
  social: Record<SocialKey, string>;
};
type SocialKey = "instagram" | "tiktok" | "x" | "facebook" | "youtube" | "website";

const SOCIAL_FIELDS: { key: SocialKey; label: string; placeholder: string; inputMode?: "url" }[] = [
  { key: "instagram", label: "Instagram", placeholder: "@yourname" },
  { key: "tiktok", label: "TikTok", placeholder: "@yourname" },
  { key: "x", label: "X (Twitter)", placeholder: "@yourname" },
  { key: "facebook", label: "Facebook page", placeholder: "facebook.com/yourpage", inputMode: "url" },
  { key: "youtube", label: "YouTube channel", placeholder: "youtube.com/@yourchannel", inputMode: "url" },
  { key: "website", label: "Website", placeholder: "yourname.com", inputMode: "url" },
];

export function ContactForm({ businessId, values }: { businessId: string; values: Values }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveContactAction, {});
  const [same, setSame] = useState(values.whatsappSame);

  return (
    <form action={formAction} noValidate className="rounded-card bg-card p-5 lift">
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
      <fieldset className="mt-2 mb-4">
        <legend className="mb-1 text-heading font-semibold">Social media</legend>
        <p className="mb-3 text-small text-ink-muted">
          Optional. Customers and brands like to see your work before they book. Paste a link or type your @username.
        </p>
        {SOCIAL_FIELDS.map((f) => (
          <Field
            key={f.key}
            id={f.key}
            name={f.key}
            label={f.label}
            inputMode={f.inputMode}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={f.placeholder}
            defaultValue={valueOf(state.values, f.key, values.social[f.key])}
            error={state.fieldErrors?.[f.key]}
          />
        ))}
      </fieldset>
      <SubmitButton pendingLabel="Saving…">Save and continue</SubmitButton>
    </form>
  );
}
