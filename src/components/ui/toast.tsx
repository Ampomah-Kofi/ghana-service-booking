"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "./icons";

/**
 * A short confirmation that slides down from the top and leaves by itself (ADR-0012).
 * Announced politely to screen readers. Pages show it from a `?done=…` style query flag; once shown,
 * the flag is dropped from the address so a refresh or Back doesn't repeat it.
 */
export function Toast({ message, param }: { message: string; param?: string }) {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (param) {
      const url = new URL(window.location.href);
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        window.history.replaceState(window.history.state, "", url);
      }
    }
    const t = window.setTimeout(() => setShown(false), 4000);
    return () => window.clearTimeout(t);
  }, [param]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-40 px-5 pt-safe-sm">
      {shown ? (
        <p className="toast glass-strong mx-auto flex max-w-sm items-center gap-2.5 rounded-full py-2.5 pr-5 pl-3 text-small font-semibold">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-on-primary">
            <CheckIcon className="size-3.5" />
          </span>
          {message}
        </p>
      ) : null}
    </div>
  );
}
