"use client";

import { valueOf } from "@/lib/form-values";
import { useActionState } from "react";
import { Field, FormMessage, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { createBusinessAction } from "./actions";

type Category = { id: string; name: string };

const kinds = [
  { value: "solo", title: "Just me", detail: "I work on my own." },
  { value: "team", title: "I have a team", detail: "Customers can choose who serves them." },
] as const;

export function CreateBusinessForm({ categories }: { categories: Category[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(createBusinessAction, {});

  return (
    <form action={formAction} noValidate className="rounded-card bg-surface-elevated p-5 shadow-card">
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />

      <fieldset className="mb-5">
        <legend className="mb-2 text-callout font-medium">Who works at your business?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {kinds.map((kind) => (
            <label
              key={kind.value}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-separator p-3 has-[:checked]:border-accent has-[:checked]:bg-accent/5"
            >
              <input
                type="radio"
                name="kind"
                value={kind.value}
                defaultChecked={valueOf(state.values, "kind", "solo") === kind.value}
                className="mt-1 accent-accent"
              />
              <span>
                <span className="block text-body font-medium">{kind.title}</span>
                <span className="block text-footnote text-text-secondary">{kind.detail}</span>
              </span>
            </label>
          ))}
        </div>
        {state.fieldErrors?.kind ? <p className="mt-1.5 text-footnote text-danger">{state.fieldErrors.kind}</p> : null}
      </fieldset>

      <Field
        id="name"
        name="name"
        label="Business or professional name"
        placeholder="e.g. Kwame Cuts"
        autoComplete="organization"
        required
        maxLength={120}
        error={state.fieldErrors?.name}
      />

      <SelectField
        id="categoryId"
        name="categoryId"
        label="What do you do?"
        required
        defaultValue={valueOf(state.values, "categoryId", "")}
        error={state.fieldErrors?.categoryId}
      >
        <option value="" disabled>
          Choose a category
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>

      <SubmitButton pendingLabel="Creating…">Continue</SubmitButton>
      <p className="mt-3 text-center text-footnote text-text-secondary">
        You can change all of this later. Nothing is public until you publish.
      </p>
    </form>
  );
}
