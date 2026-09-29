import "server-only";
import { AppError, type AppErrorCode } from "@/lib/errors";

type DbError = { code?: string; message: string; details?: string | null };

const byCode: Record<string, AppErrorCode> = {
  BZ401: "UNAUTHENTICATED",
  BZ403: "FORBIDDEN",
  BZ404: "NOT_FOUND",
  BZ409: "CONFLICT",
  BZ422: "VALIDATION",
  // A suspended account (Phase 10): forbidden, but the message says why.
  BZ423: "FORBIDDEN",
  BZ429: "LIMIT_REACHED",
  "42501": "FORBIDDEN",
};

/**
 * Maps errors raised by our SQL functions (SQLSTATE BZxxx, messages written for
 * users) to AppError. Unknown database errors become a generic message so internals never leak.
 */
export function toAppError(error: DbError, fallback = "Something went wrong. Please try again."): AppError {
  const code = error.code ? byCode[error.code] : undefined;
  if (!code) {
    console.error("[db]", error.code, error.message);
    return new AppError("INTERNAL", fallback);
  }
  const message =
    code === "FORBIDDEN" && error.code !== "BZ423"
      ? "You don't have access to this business."
      : capitalise(error.message);
  return new AppError(code, message, error.details ?? undefined);
}

function capitalise(message: string): string {
  const text = message.charAt(0).toUpperCase() + message.slice(1);
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
