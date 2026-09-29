"use client";

import { useState } from "react";

/** Copies a short value (a number, a reference). If the browser refuses, the text stays selectable. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("done");
    } catch {
      setState("failed");
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="pressable min-h-11 shrink-0 rounded-full px-3 text-small font-medium text-primary hover:bg-fill"
    >
      <span aria-live="polite">{state === "done" ? "Copied" : state === "failed" ? "Select it" : "Copy"}</span>
    </button>
  );
}
