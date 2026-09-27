import "server-only";
import type { ZodError } from "zod";
import { AppError } from "@/lib/errors";

/** State returned by form Server Actions (rendered by useActionState). */
export type FormState = {
  ok?: boolean;
  message?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
};

export function fieldErrorsFrom(error: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return { fieldErrors, message: "Please fix the highlighted fields." };
}

/** Converts expected errors into form state; anything unexpected is logged and hidden. */
export function formError(error: unknown): FormState {
  if (error instanceof AppError) return { message: error.message };
  console.error("[action]", error);
  return { message: "Something went wrong. Please try again." };
}
