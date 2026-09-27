"use client";

import { valueOf, checkedOf } from "@/lib/form-values";
import { useActionState } from "react";
import { Field, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { saveCategoryAction } from "./actions";

type Values = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  keywords: string;
  sortOrder: number;
  isActive: boolean;
};

export function CategoryForm({ values }: { values: Values }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveCategoryAction, {});
  const e = state.fieldErrors ?? {};
  const key = values.id ?? "new";
  return (
    <form action={formAction} noValidate className="grid gap-1 p-4">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <FormMessage tone="notice" message={state.notice} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          id={`${key}-name`}
          name="name"
          label="Name"
          defaultValue={valueOf(state.values, "name", values.name)}
          error={e.name}
        />
        <Field
          id={`${key}-slug`}
          name="slug"
          label="Slug"
          defaultValue={valueOf(state.values, "slug", values.slug)}
          autoCapitalize="none"
          error={e.slug}
        />
      </div>
      <Field
        id={`${key}-description`}
        name="description"
        label="Description"
        defaultValue={valueOf(state.values, "description", values.description)}
        error={e.description}
      />
      <Field
        id={`${key}-keywords`}
        name="keywords"
        label="Search keywords (comma separated)"
        defaultValue={valueOf(state.values, "keywords", values.keywords)}
        error={e.keywords}
      />
      <div className="grid grid-cols-2 items-end gap-3">
        <Field
          id={`${key}-sortOrder`}
          name="sortOrder"
          label="Order"
          inputMode="numeric"
          defaultValue={valueOf(state.values, "sortOrder", String(values.sortOrder))}
          error={e.sortOrder}
        />
        <label className="mb-4 flex min-h-11 items-center gap-3 text-body">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={checkedOf(state.values, "isActive", values.isActive)}
            className="size-5 accent-accent"
          />
          Visible to everyone
        </label>
      </div>
      <Field
        id={`${key}-reason`}
        name="reason"
        label="Reason (saved in the audit log)"
        placeholder="e.g. Requested by providers"
        error={e.reason}
      />
      <SubmitButton pendingLabel="Saving…">{values.id ? "Save category" : "Create category"}</SubmitButton>
    </form>
  );
}
