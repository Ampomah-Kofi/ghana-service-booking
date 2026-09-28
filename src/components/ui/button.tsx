import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "plain";

const styles: Record<Variant, string> = {
  primary:
    "w-full bg-primary text-on-primary font-semibold hover:bg-primary-hover active:bg-primary-hover disabled:opacity-50",
  secondary:
    "w-full bg-fill text-ink font-semibold hover:bg-ink/10 active:bg-ink/10 disabled:opacity-50",
  danger: "w-full bg-danger/10 text-danger font-semibold hover:bg-danger/15 disabled:opacity-50",
  plain: "text-primary font-medium hover:opacity-80 disabled:opacity-40",
};

/** Capsule button, 48px tall (docs/design.md §3). Secondary is a soft grey fill, never an outline. */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 pressable text-body transition-colors ${styles[variant]} ${className}`}
    />
  );
}
