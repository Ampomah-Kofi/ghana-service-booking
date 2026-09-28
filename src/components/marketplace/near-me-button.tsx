"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NavigationIcon } from "@/components/ui/icons";

/**
 * Asks for the phone's location only when tapped (never on page load), then
 * searches nearby. Coordinates are rounded and only used for this search.
 */
export function NearMeButton({ query }: { query: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle");

  function locate() {
    if (!("geolocation" in navigator)) return setStatus("denied");
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const params = new URLSearchParams({
          q: query.replace(/\b(near me|nearby)\b/gi, "").trim(),
          near: `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`,
        });
        router.push(`/search?${params}`);
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <div className="flex items-center gap-2 px-1">
      <button
        type="button"
        onClick={locate}
        disabled={status === "locating"}
        className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-small font-medium text-primary disabled:opacity-60"
      >
        <NavigationIcon className="size-4" />
        {status === "locating" ? "Finding you…" : "Near me"}
      </button>
      {status === "denied" ? (
        <span role="status" className="text-small text-ink-muted">
          Location is off. Type your area instead, e.g. “in Osu”.
        </span>
      ) : null}
    </div>
  );
}
