"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { publishAction, unpublishAction } from "./actions";

export function PublishButton({ businessId, ready }: { businessId: string; ready: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(publishAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="error" message={state.message} />
      <SubmitButton pendingLabel="Publishing…" disabled={!ready}>
        Publish my page
      </SubmitButton>
    </form>
  );
}

export function UnpublishButton({ businessId }: { businessId: string }) {
  const [state, action] = useActionState<FormState, FormData>(unpublishAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="error" message={state.message} />
      <SubmitButton variant="plain" pendingLabel="Hiding…" className="w-full text-danger">
        Hide my page
      </SubmitButton>
    </form>
  );
}
