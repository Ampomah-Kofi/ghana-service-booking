"use client";

import { useEffect } from "react";

/** Scrolls the selected day of a horizontal strip into the middle, smoothly (instant with reduced motion). */
export function CenterSelected({ listId }: { listId: string }) {
  useEffect(() => {
    const el = document.getElementById(listId)?.querySelector<HTMLElement>('[aria-current="date"]');
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [listId]);
  return null;
}
