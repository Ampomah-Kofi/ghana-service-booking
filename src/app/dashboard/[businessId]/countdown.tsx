"use client";

import { useEffect, useState } from "react";
import { countdownLabel, countdownShort, progressThrough } from "@/lib/countdown";

/** Re-render every 20 s so the labels and bar stay live (the server renders the first frame). */
function useNow(initial: string) {
  const [now, setNow] = useState(() => new Date(initial));
  useEffect(() => {
    // Catch up once right after hydration, then every 20 s.
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const t = window.setInterval(() => setNow(new Date()), 20_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, []);
  return now;
}

/** "Up next · in 25 min" → "Happening now". */
export function Countdown({ at, initial }: { at: string; initial: string }) {
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    const tick = () => setLabel(countdownLabel(new Date(at), new Date()));
    const t = window.setInterval(tick, 20_000);
    return () => window.clearInterval(t);
  }, [at]);
  return <span suppressHydrationWarning>{label}</span>;
}

/** Heading of the live card: "UP NEXT" or "NOW", with a pulsing dot once it has started. */
export function LiveHeading({ start, renderedAt }: { start: string; renderedAt: string }) {
  const now = useNow(renderedAt);
  const started = now >= new Date(start);
  return (
    <span className="inline-flex items-center gap-2" suppressHydrationWarning>
      <span aria-hidden="true" className={`size-2 rounded-full ${started ? "live-dot bg-green-300" : "bg-white/60"}`} />
      {started ? "Now" : "Up next"}
    </span>
  );
}

/** The frosted pill: "in 25 min", "20 min left". */
export function LivePill({ start, end, renderedAt }: { start: string; end: string; renderedAt: string }) {
  const now = useNow(renderedAt);
  return (
    <span
      suppressHydrationWarning
      className="rounded-full bg-white/15 px-3 py-1 text-small font-semibold tabular-nums backdrop-blur-md"
    >
      {countdownShort(new Date(start), new Date(end), now)}
    </span>
  );
}

/** A thin bar showing how far through the appointment it is (hidden before it starts). */
export function LiveProgress({ start, end, renderedAt }: { start: string; end: string; renderedAt: string }) {
  const now = useNow(renderedAt);
  const p = progressThrough(new Date(start), new Date(end), now);
  if (p === 0) return null;
  return (
    <div
      role="progressbar"
      aria-label="Time through this appointment"
      aria-valuenow={Math.round(p * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="mt-4 h-1 overflow-hidden rounded-full bg-white/20"
    >
      <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${p * 100}%` }} />
    </div>
  );
}
