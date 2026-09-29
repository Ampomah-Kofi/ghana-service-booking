"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";

/** Suspend or restore, with a reason for the audit log. Only shown to super admins and moderators. */
export function SuspendForm({
  id,
  suspended,
  action,
  what,
}: {
  id: string;
  suspended: boolean;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** "business" or "account", for the button and hint. */
  what: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  if (state.ok) return <p className="text-body font-medium text-success">{state.notice}</p>;
  return (
    <form action={formAction} noValidate className="grid grid-cols-[minmax(0,1fr)]">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="suspend" value={suspended ? "false" : "true"} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <Field
        id={`reason-${id}`}
        name="reason"
        label="Reason (audit log)"
        placeholder={suspended ? "e.g. Owner sent proof, appeal accepted" : "e.g. Fake photos reported by 3 customers"}
        hint={
          suspended
            ? undefined
            : what === "business"
              ? "Hidden from search and its page until restored. Its team can't re-publish it."
              : "They can still sign in and see their bookings, but can't book, review or open a business."
        }
        defaultValue={valueOf(state.values, "reason", "")}
        error={state.fieldErrors?.reason}
      />
      <SubmitButton pendingLabel="Saving…" variant={suspended ? "primary" : "danger"}>
        {suspended ? `Restore ${what}` : `Suspend ${what}`}
      </SubmitButton>
    </form>
  );
}
