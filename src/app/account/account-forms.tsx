"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { deleteAccountAction, updateNameAction } from "./actions";

export function EditNameSheet({ current }: { current: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(updateNameAction, {});
  return (
    <>
      {state.ok ? <Toast message={state.notice ?? "Saved"} /> : null}
      <Sheet id="edit-name" title="Your name">
        <form action={formAction} className="grid gap-3">
          <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
          <label htmlFor="fullName" className="text-small font-medium">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            autoComplete="name"
            maxLength={120}
            defaultValue={valueOf(state.values, "fullName", current)}
            className="block min-h-12 w-full rounded-control border border-border bg-card px-3 text-body outline-none focus:border-primary"
          />
          {state.fieldErrors?.fullName ? <p className="text-small text-danger">{state.fieldErrors.fullName}</p> : null}
          <p className="text-small text-ink-muted">
            Businesses see it on your bookings. Reviews show your first name and initial.
          </p>
          <SubmitButton pendingLabel="Saving…">Save name</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}

/** Deleting asks for a typed confirmation and says exactly what happens (SPEC §22). */
export function DeleteAccountSheet({ blocker }: { blocker: string | null }) {
  const [state, formAction] = useActionState<FormState, FormData>(deleteAccountAction, {});
  return (
    <Sheet id="delete-account" title="Delete your account?">
      {blocker ? (
        <p className="pb-2 text-body">{blocker}</p>
      ) : (
        <form action={formAction} className="grid gap-3">
          <ul className="grid list-disc gap-1.5 pl-5 text-body text-ink-muted">
            <li>Your profile, favourites and sign-in are deleted.</li>
            <li>Businesses keep their booking records, without your name or phone number.</li>
            <li>Your reviews stay, shown as “Former customer”.</li>
            <li>This can’t be undone.</li>
          </ul>
          <FormMessage tone="error" message={state.message} />
          <label htmlFor="confirm" className="text-small font-medium">
            Type DELETE to confirm
          </label>
          <input
            id="confirm"
            name="confirm"
            autoComplete="off"
            autoCapitalize="characters"
            className="block min-h-12 w-full rounded-control border border-border bg-card px-3 text-body outline-none focus:border-primary"
          />
          <SubmitButton pendingLabel="Deleting…" className="bg-danger! hover:bg-danger!">
            Delete my account
          </SubmitButton>
        </form>
      )}
    </Sheet>
  );
}
