"use client";

import { useRef, useState } from "react";
import { StarIcon } from "@/components/ui/icons";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/**
 * 1–5 star picker (Phase 7). Five real radio buttons (works without JavaScript and with a keyboard:
 * arrows move, like any radio group), drawn as stars; with JavaScript you can also drag across them.
 */
export function StarInput({
  name = "rating",
  defaultValue = 0,
  error,
}: {
  name?: string;
  defaultValue?: number;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const row = useRef<HTMLDivElement>(null);
  const shown = hover || value;

  const valueAt = (clientX: number) => {
    const box = row.current?.getBoundingClientRect();
    if (!box) return value;
    return Math.min(5, Math.max(1, Math.ceil(((clientX - box.left) / box.width) * 5)));
  };

  return (
    <fieldset>
      <legend className="sr-only">Your rating</legend>
      <div
        ref={row}
        className="flex w-fit max-w-full touch-none flex-wrap gap-1"
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" && e.buttons === 0) setHover(valueAt(e.clientX));
          else if (e.buttons) setValue(valueAt(e.clientX));
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setValue(valueAt(e.clientX));
        }}
        onPointerLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => setValue(n)}
              className="peer sr-only"
            />
            <span className="sr-only">
              {n} star{n === 1 ? "" : "s"}, {WORDS[n]}
            </span>
            <StarIcon
              filled={n <= shown}
              className={`size-10 transition-transform peer-focus-visible:outline-2 peer-focus-visible:outline-primary ${
                n <= shown ? "text-star" : "text-ink-muted/40"
              } ${n === value ? "pop" : ""}`}
            />
          </label>
        ))}
      </div>
      <p aria-live="polite" className="mt-1 min-h-5 text-small font-semibold text-ink-muted">
        {WORDS[shown]}
      </p>
      {error ? <p className="text-small text-danger">{error}</p> : null}
    </fieldset>
  );
}
