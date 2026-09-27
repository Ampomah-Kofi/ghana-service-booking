import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

/** Labelled input with inline validation message (docs/design.md §3). */
export function Field({ id, label, error, hint, className = "", ...input }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-callout font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block min-h-11 w-full rounded-control border bg-surface-elevated px-3 text-body outline-none transition-colors placeholder:text-text-secondary focus:border-accent ${
          error ? "border-danger" : "border-separator"
        } ${className}`}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-footnote text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-footnote text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ message, tone }: { message?: string; tone: "error" | "notice" }) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mb-4 rounded-control px-3 py-2 text-callout ${tone === "error" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}
    >
      {message}
    </p>
  );
}

const controlClass = (error?: string) =>
  `block min-h-11 w-full rounded-control border bg-surface-elevated px-3 text-body outline-none transition-colors placeholder:text-text-secondary focus:border-accent ${
    error ? "border-danger" : "border-separator"
  }`;

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="mt-1.5 text-footnote text-danger" role="alert">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-hint`} className="mt-1.5 text-footnote text-text-secondary">
      {hint}
    </p>
  ) : null;
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export function SelectField({ id, label, error, hint, children, ...select }: SelectFieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-callout font-medium">
        {label}
      </label>
      <select
        // React applies defaultValue to <select> only on mount; remount when a refilled
        // value arrives so the form reset after a failed submit keeps the choice.
        key={select.defaultValue === undefined ? undefined : String(select.defaultValue)}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={controlClass(error)}
        {...select}
      >
        {children}
      </select>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

export function TextAreaField({ id, label, error, hint, ...textarea }: TextAreaFieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-callout font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${controlClass(error)} py-2.5`}
        {...textarea}
      />
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}
