"use client";

import { useEffect } from "react";
import { markAllReadAction } from "./actions";

/** Clears the unread dots a moment after the inbox is shown (so you still see what was new). */
export function MarkReadOnView({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (!hasUnread) return;
    const t = window.setTimeout(() => void markAllReadAction(), 1500);
    return () => window.clearTimeout(t);
  }, [hasUnread]);
  return null;
}
