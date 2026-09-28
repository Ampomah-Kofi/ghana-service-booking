"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * "12:48 left to pay" while a deposit holds the slot (Phase 9). With `watch`, it also refreshes the
 * page every few seconds so the payment landing (webhook) shows without a tap.
 */
export function HoldCountdown({ until, watch = false }: { until: string; watch?: boolean }) {
  const router = useRouter();
  const end = new Date(until).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = watch ? setInterval(() => router.refresh(), 3000) : null;
    return () => {
      clearInterval(tick);
      if (poll) clearInterval(poll);
    };
  }, [router, watch]);
  const left = Math.max(0, Math.floor((end - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className="tabular-nums" role="timer" aria-live="off">
      {left > 0 ? `${mm}:${ss} left to pay` : "Time's up"}
    </span>
  );
}
