import type { ReactNode } from "react";
import { XIcon } from "./icons";

/**
 * Bottom sheet (ADR-0012) built on the HTML popover API: opens from any
 * `<button popoverTarget={id}>` with no JavaScript, closes on the ✕, Escape or a tap outside.
 * A bottom sheet with a grab handle on phones, a centred card from md.
 */
export function Sheet({
  id,
  title,
  children,
  label,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
  /** Accessible name when the title isn't plain text. */
  label?: string;
}) {
  return (
    <div
      id={id}
      popover="auto"
      role="dialog"
      aria-label={label}
      aria-labelledby={label ? undefined : `${id}-title`}
      className="sheet"
    >
      {/* Grab zone: drag down to close on phones (sheet-gestures.tsx); doesn't scroll, so touch-none. */}
      <div data-sheet-grab className="touch-none">
        <div aria-hidden="true" className="mx-auto mt-2 mb-1 h-1.5 w-10 rounded-full bg-ink/20 md:hidden" />
        <div className="flex items-start gap-3 px-5 pt-2">
          <h2 id={`${id}-title`} className="min-w-0 flex-1 pt-1.5 text-title font-bold">
            {title}
          </h2>
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label="Close"
            className="pressable -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-ink-muted"
          >
            <XIcon className="size-4.5" />
          </button>
        </div>
      </div>
      <div className="px-5 pt-3 pb-safe-sm">{children}</div>
    </div>
  );
}
