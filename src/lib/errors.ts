/**
 * Error codes shared by Server Actions and /api/v1 (docs/architecture.md §12).
 * `code` is stable and machine-readable; `message` is safe to show to users.
 */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "LIMIT_REACHED"
  | "RATE_LIMITED"
  | "INTERNAL";

const httpStatus: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  LIMIT_REACHED: 429,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Optional machine-readable detail, e.g. the missing items when publishing. */
  readonly detail?: string;

  constructor(code: AppErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = httpStatus[code];
    this.detail = detail;
  }
}
