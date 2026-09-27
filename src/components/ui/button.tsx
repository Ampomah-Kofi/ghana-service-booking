import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "plain";

const styles: Record<Variant, string> = {
  primary:
    "w-full bg-accent text-on-accent font-semibold hover:bg-accent-pressed active:bg-accent-pressed disabled:opacity-50",
  plain: "text-accent font-medium hover:opacity-80 disabled:opacity-40",
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
      className={`inline-flex min-h-11 items-center justify-center rounded-control px-4 text-body transition-colors ${styles[variant]} ${className}`}
    />
  );
}
