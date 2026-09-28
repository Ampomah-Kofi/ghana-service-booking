"use client";

import { valueOf } from "@/lib/form-values";
import { useActionState } from "react";
import { Field, FormMessage, SelectField, TextAreaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { saveAboutAction, saveSlugAction } from "../../actions";

type Props = {
  businessId: string;
  categories: { id: string; name: string }[];
  values: { kind: "solo" | "team"; name: string; categoryId: string; description: string };
};

export function AboutForm({ businessId, categories, values }: Props) {
  const [state, formAction] = useActionState<FormState, FormData>(saveAboutAction, {});
  return (
    <form action={formAction} noValidate className="rounded-card bg-card p-5 lift">
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <Field
        id="name"
        name="name"
        label="Business name"
        required
        maxLength={120}
        defaultValue={valueOf(state.values, "name", values.name)}
        error={state.fieldErrors?.name}
      />
      <SelectField
        id="categoryId"
        name="categoryId"
        label="Category"
        defaultValue={valueOf(state.values, "categoryId", values.categoryId)}
        error={state.fieldErrors?.categoryId}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="kind"
        name="kind"
        label="Who works here?"
        defaultValue={valueOf(state.values, "kind", values.kind)}
        error={state.fieldErrors?.kind}
      >
        <option value="solo">Just me</option>
        <option value="team">I have a team</option>
      </SelectField>
      <TextAreaField
        id="description"
        name="description"
        label="Description"
        maxLength={2000}
        defaultValue={valueOf(state.values, "description", values.description)}
        placeholder="What you do, your style, and what makes you different."
        hint="Optional. Customers see this on your page."
        error={state.fieldErrors?.description}
      />
      <SubmitButton pendingLabel="Saving…">Save and continue</SubmitButton>
    </form>
  );
}

export function SlugForm({
  businessId,
  slug,
  locked,
  siteUrl,
}: {
  businessId: string;
  slug: string;
  locked: boolean;
  siteUrl: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveSlugAction, {});
  const host = siteUrl.replace(/^https?:\/\//, "");
  return (
    <form action={formAction} noValidate className="rounded-card bg-card p-5 lift">
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="notice" message={state.notice} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <Field
        id="slug"
        name="slug"
        label="Web address"
        defaultValue={valueOf(state.values, "slug", slug)}
        disabled={locked}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={60}
        hint={
          locked
            ? "Locked after publishing, so links and QR codes you've shared keep working."
            : `${host}/business/${slug}. You can change this until you publish.`
        }
        error={state.fieldErrors?.slug}
      />
      {locked ? null : (
        <SubmitButton variant="plain" pendingLabel="Saving…" className="w-full">
          Update web address
        </SubmitButton>
      )}
    </form>
  );
}
