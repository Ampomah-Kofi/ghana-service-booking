"use client";

import { useEffect, useState } from "react";
import { countdownLabel } from "@/lib/countdown";

/** "in 25 min" → "in 24 min" … → "Happening now", ticking every 20 s (server renders the first value). */
export function Countdown({ at, initial }: { at: string; initial: string }) {
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    const tick = () => setLabel(countdownLabel(new Date(at), new Date()));
    const t = window.setInterval(tick, 20_000);
    return () => window.clearInterval(t);
  }, [at]);
  return <span suppressHydrationWarning>{label}</span>;
}
