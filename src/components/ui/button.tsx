import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "plain";

const styles: Record<Variant, string> = {
  primary:
    "w-full bg-primary text-on-primary font-semibold hover:bg-primary-hover active:bg-primary-hover disabled:opacity-50",
  secondary:
    "w-full border border-border bg-card text-ink font-semibold hover:bg-fill active:bg-fill disabled:opacity-50",
  danger: "w-full border border-border bg-card text-danger font-semibold hover:bg-danger/5 disabled:opacity-50",
  plain: "text-primary font-medium hover:opacity-80 disabled:opacity-40",
};

/** 44px minimum tap target (docs/design.md §3). */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center rounded-control px-4 text-body transition-colors ${styles[variant]} ${className}`}
    />
  );
}
