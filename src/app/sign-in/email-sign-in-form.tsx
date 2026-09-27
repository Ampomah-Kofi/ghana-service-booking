"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { emailSignInAction, type EmailFormState } from "./actions";

const initialState: EmailFormState = {};

export function EmailSignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(emailSignInAction, initialState);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage tone="notice" message={state.notice} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <Field
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        defaultValue={state.email}
        error={state.fieldErrors?.email}
      />
      <Field
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        hint="New accounts need at least 10 characters."
        error={state.fieldErrors?.password}
      />
      <Button type="submit" name="intent" value="sign-in" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Button type="submit" variant="plain" name="intent" value="sign-up" disabled={pending} className="mt-3 w-full">
        Create an account with email
      </Button>
    </form>
  );
}
