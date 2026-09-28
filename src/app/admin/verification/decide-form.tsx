"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { decideVerificationAction } from "./actions";

const input =
  "block min-h-11 w-full rounded-control border border-border bg-card px-3 text-body outline-none focus:border-primary";

/** Verify or decline a request (or remove a check), with a reason for the audit log and an optional note to the owner. */
export function DecideForm({ businessId, verified }: { businessId: string; verified: boolean }) {
  const [state, formAction] = useActionState<FormState, FormData>(decideVerificationAction, {});
  if (state.ok) return <p className="text-small font-medium text-success">{state.notice}</p>;
  return (
    <form action={formAction} className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="error" message={state.fieldErrors?.reason ?? state.fieldErrors?.note ?? state.message} />
      <label htmlFor={`reason-${businessId}`} className="sr-only">
        Reason for the audit log
      </label>
      <input id={`reason-${businessId}`} name="reason" placeholder="What you checked (audit log)" className={input} />
      {verified ? null : (
        <>
          <label htmlFor={`note-${businessId}`} className="sr-only">
            Note to the owner (optional)
          </label>
          <input
            id={`note-${businessId}`}
            name="note"
            maxLength={300}
            placeholder="Note to owner (optional)"
            className={input}
          />
        </>
      )}
      {verified ? (
        <SubmitButton name="status" value="none" pendingLabel="…" variant="danger">
          Remove check
        </SubmitButton>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <SubmitButton name="status" value="declined" pendingLabel="…" variant="secondary">
            Decline
          </SubmitButton>
          <SubmitButton name="status" value="verified" pendingLabel="…">
            Verify
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
