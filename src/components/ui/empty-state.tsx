import Link from "next/link";
import type { ComponentType } from "react";

/**
 * "Nothing here yet" screen (iOS content-unavailable style, ADR-0012): a small illustration in the
 * category-cover style, one sentence, one action. Inline SVG only, zero image bytes.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className = "py-10",
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: { href: string; label: string; primary?: boolean };
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <span aria-hidden="true" className="relative mb-4 flex size-24 items-center justify-center">
        <svg viewBox="0 0 96 96" className="absolute inset-0 size-full text-primary">
          <circle cx="48" cy="48" r="46" fill="currentColor" opacity="0.1" />
          <circle cx="78" cy="22" r="10" fill="currentColor" opacity="0.14" />
          <circle cx="16" cy="74" r="6" fill="currentColor" opacity="0.18" />
          <circle cx="48" cy="48" r="30" fill="currentColor" opacity="0.12" />
        </svg>
        <Icon className="relative size-9 text-primary" />
      </span>
      <p className="text-title font-semibold">{title}</p>
      {body ? <p className="mt-1.5 max-w-xs text-body text-ink-muted">{body}</p> : null}
      {action ? (
        <Link
          href={action.href}
          className={
            action.primary
              ? "pressable mt-5 inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-semibold text-on-primary hover:bg-primary-hover"
              : "mt-3 inline-flex min-h-11 items-center font-semibold text-primary"
          }
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
