"use client";

import { useEffect } from "react";

/**
 * Swipe a bottom sheet down to close it, like iOS (ADR-0012). One listener for every `.sheet`;
 * the drag starts on the grab handle / title area (`[data-sheet-grab]`, which never scrolls).
 * Past 90 px (or a quick flick) it closes; otherwise it springs back. Phones only; a nicety on top
 * of the ✕ button, Escape and tapping outside.
 */
export function SheetGestures() {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 47.99rem)").matches) return;
    let sheet: HTMLElement | null = null;
    let startY = 0;
    let startT = 0;
    let dy = 0;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const target = e.target as HTMLElement;
      const el = target.closest<HTMLElement>(".sheet:popover-open");
      if (!el || !target.closest("[data-sheet-grab]") || target.closest("button, a")) return;
      sheet = el;
      startY = e.clientY;
      startT = e.timeStamp;
      dy = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!sheet) return;
      dy = Math.max(0, e.clientY - startY);
      if (dy > 4) {
        sheet.classList.add("dragging");
        // A little resistance, like a rubber band.
        sheet.style.setProperty("--sheet-drag", `${Math.round(dy * 0.9)}px`);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!sheet) return;
      const el = sheet;
      sheet = null;
      el.classList.remove("dragging");
      const fast = dy > 30 && dy / Math.max(1, e.timeStamp - startT) > 0.6;
      if (dy > 90 || fast) {
        el.hidePopover();
        // Reset after the close transition so it opens from the bottom next time.
        window.setTimeout(() => el.style.removeProperty("--sheet-drag"), 450);
      } else {
        el.style.removeProperty("--sheet-drag");
      }
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, []);
  return null;
}
