"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { HoursRange } from "@/lib/hours";
import type { FormState } from "@/server/actions";
import { saveHoursAction } from "@/app/dashboard/[businessId]/schedule-actions";
import { WeekHoursEditor } from "./week-hours-editor";

export function BusinessHoursForm({
  businessId,
  initial,
  returnTo,
}: {
  businessId: string;
  initial: HoursRange[];
  returnTo?: "setup";
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveHoursAction, {});
  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="businessId" value={businessId} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <FormMessage tone="notice" message={state.notice} />
      <FormMessage tone="error" message={state.message} />
      <WeekHoursEditor name="hours" initial={initial} />
      <SubmitButton pendingLabel="Saving…" className="mt-5">
        {returnTo === "setup" ? "Save and continue" : "Save hours"}
      </SubmitButton>
    </form>
  );
}
