import type { ReactNode } from "react";

/**
 * iOS large title (ADR-0012): the big heading shrinks as you scroll and a compact glass bar
 * with the same title fades in at the top. Pure CSS (scroll-driven animations); phones only.
 */
export function LargeTitle({
  title,
  eyebrow,
  trailing,
  className = "mb-5",
}: {
  title: string;
  eyebrow?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="compact-bar glass-strong pointer-events-none fixed inset-x-0 top-0 z-30 pt-safe-sm pb-2.5 text-center md:hidden"
      >
        <p className="mx-auto max-w-2xl truncate px-16 text-heading font-semibold">{title}</p>
      </div>
      <header className={`flex items-end justify-between gap-3 pt-3 ${className}`}>
        <div className="large-title min-w-0">
          {eyebrow ? (
            <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">{eyebrow}</p>
          ) : null}
          <h1 className="text-display font-bold">{title}</h1>
        </div>
        {trailing ? <div className="mb-0.5 shrink-0">{trailing}</div> : null}
      </header>
    </>
  );
}
