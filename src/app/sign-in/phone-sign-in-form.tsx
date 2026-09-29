"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { phoneSignInAction, type PhoneFormState } from "./actions";

const initialState: PhoneFormState = { step: "phone" };

export function PhoneSignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(phoneSignInAction, initialState);

  if (state.step === "code" && state.phone) {
    return (
      <form action={formAction} noValidate>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="phone" value={state.phone} />
        <p className="mb-4 text-body text-ink-muted">
          Enter the 6-digit code we sent to{" "}
          <span className="font-medium whitespace-nowrap text-ink">{state.phoneDisplay ?? state.phone}</span>.
        </p>
        <FormMessage tone="notice" message={state.notice} />
        <FormMessage tone="error" message={state.fieldErrors?.code ? undefined : state.message} />
        <Field
          id="code"
          name="code"
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          error={state.fieldErrors?.code}
        />
        <Button type="submit" name="intent" value="verify" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
        <div className="mt-4 flex justify-between">
          <Button type="submit" variant="plain" name="intent" value="change-number" disabled={pending} formNoValidate>
            Change number
          </Button>
          <Button type="submit" variant="plain" name="intent" value="resend" disabled={pending} formNoValidate>
            Resend code
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage tone="error" message={state.fieldErrors?.phone ? undefined : state.message} />
      <Field
        id="phone"
        name="phone"
        type="tel"
        label="Phone number"
        placeholder="024 123 4567"
        autoComplete="tel"
        inputMode="tel"
        required
        defaultValue={state.phone}
        hint="We'll text you a code. Standard SMS rates may apply."
        error={state.fieldErrors?.phone}
      />
      <Button type="submit" name="intent" value="send" disabled={pending}>
        {pending ? "Sending code…" : "Send code"}
      </Button>
    </form>
  );
}
