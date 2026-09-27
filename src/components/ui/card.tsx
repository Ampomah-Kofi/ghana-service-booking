import type { ReactNode } from "react";

/** Inset grouped section (iOS Settings style), per docs/design.md §3. */
export function GroupedSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      {title ? (
        <h2 className="mb-2 px-4 text-footnote font-medium uppercase tracking-wide text-text-secondary">{title}</h2>
      ) : null}
      <div className="overflow-hidden rounded-card bg-surface-elevated shadow-card">{children}</div>
      {footer ? <p className="mt-2 px-4 text-footnote text-text-secondary">{footer}</p> : null}
    </section>
  );
}

export function GroupedRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-separator px-4 py-3 last:border-b-0">
      <span className="text-body">{label}</span>
      <span className="text-right text-body text-text-secondary">{value}</span>
    </div>
  );
}
