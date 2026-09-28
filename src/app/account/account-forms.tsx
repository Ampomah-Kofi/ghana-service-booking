"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import { valueOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { deleteAccountAction, updateNameAction } from "./actions";
import { saveMessagePreferencesAction } from "@/app/notifications/actions";

export function EditNameSheet({ current }: { current: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(updateNameAction, {});
  return (
    <>
      {state.ok ? <Toast message={state.notice ?? "Saved"} /> : null}
      <Sheet id="edit-name" title="Your name">
        <form action={formAction} className="grid grid-cols-[minmax(0,1fr)] gap-3">
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
        <form action={formAction} className="grid grid-cols-[minmax(0,1fr)] gap-3">
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

/** How we reach you (Phase 8): one text channel (SMS, WhatsApp or none) plus email. */
export function MessagePreferencesForm({
  text,
  email,
  hasEmail,
}: {
  text: "sms" | "whatsapp" | "none";
  email: boolean;
  hasEmail: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveMessagePreferencesAction, {});
  const current = valueOf(state.values, "text", text);
  return (
    <form action={formAction}>
      {state.ok ? <Toast message={state.notice ?? "Saved"} /> : null}
      <fieldset className="ios-list">
        <legend className="sr-only">Text me by</legend>
        {(
          [
            ["sms", "SMS", "Works on every phone"],
            ["whatsapp", "WhatsApp", "If you use WhatsApp on this number"],
            ["none", "Don't text me", "You'll still see everything in the app"],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-body">{label}</span>
              <span className="block text-small text-ink-muted">{hint}</span>
            </span>
            <input
              type="radio"
              name="text"
              value={value}
              defaultChecked={current === value}
              className="size-5 accent-primary"
            />
          </label>
        ))}
        <label className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-body">Email me confirmations</span>
            <span className="block text-small text-ink-muted">
              {hasEmail ? "Booked, moved and cancelled" : "Add an email to your account first"}
            </span>
          </span>
          <input type="checkbox" role="switch" name="email" defaultChecked={email && hasEmail} disabled={!hasEmail} />
        </label>
      </fieldset>
      <div className="border-t border-border px-4 py-3">
        <SubmitButton pendingLabel="Saving…" variant="secondary">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
