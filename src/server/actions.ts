import "server-only";
import type { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import type { FormValues } from "@/lib/form-values";

/** State returned by form Server Actions (rendered by useActionState). */
export type FormState = {
  ok?: boolean;
  message?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
  /** What was submitted, so fields can be refilled after React resets the form. */
  values?: FormValues;
};

/** Text fields only (files and secrets are never echoed back). */
export function formValues(formData?: FormData): FormValues | undefined {
  if (!formData) return undefined;
  const values: FormValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key === "password" || key.startsWith("$ACTION")) continue;
    const existing = values[key];
    values[key] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return values;
}

export function fieldErrorsFrom(error: ZodError, formData?: FormData): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return { fieldErrors, message: "Please fix the highlighted fields.", values: formValues(formData) };
}

/** Converts expected errors into form state; anything unexpected is logged and hidden. */
export function formError(error: unknown, formData?: FormData): FormState {
  const values = formValues(formData);
  if (error instanceof AppError) return { message: error.message, values };
  console.error("[action]", error);
  return { message: "Something went wrong. Please try again.", values };
}
