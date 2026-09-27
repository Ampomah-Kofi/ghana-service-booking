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
      {title ? <h2 className="mb-2 px-4 text-heading font-semibold text-ink">{title}</h2> : null}
      <div className="overflow-hidden rounded-card bg-card border border-border">{children}</div>
      {footer ? <p className="mt-2 px-4 text-small text-ink-muted">{footer}</p> : null}
    </section>
  );
}

export function GroupedRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <span className="text-body">{label}</span>
      <span className="text-right text-body text-ink-muted">{value}</span>
    </div>
  );
}
