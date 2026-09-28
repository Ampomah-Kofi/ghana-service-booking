import type { ReactNode } from "react";

export type BookingSummary = { title: string; detail: string };

/**
 * Persistent bottom bar in the booking flow (docs/design.md §3a): what you've chosen so far,
 * and the step's main button within thumb reach.
 */
export function BookingBar({ summary, children }: { summary: BookingSummary; children?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border bg-card px-4 pb-safe-sm pt-3 shadow-sheet">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold">{summary.title}</p>
          <p className="truncate text-small tabular-nums text-ink-muted">{summary.detail}</p>
        </div>
        {children ? <div className="w-44 shrink-0">{children}</div> : null}
      </div>
    </div>
  );
}

/** "Step 2 of 4" with a slim progress bar. */
export function StepIndicator({ step, of }: { step: number; of: number }) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-small text-ink-muted">
        Step {step} of {of}
      </p>
      <div
        className="h-1 overflow-hidden rounded-full bg-fill"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={of}
        aria-valuenow={step}
        aria-label="Booking progress"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(step / of) * 100}%` }} />
      </div>
    </div>
  );
}
