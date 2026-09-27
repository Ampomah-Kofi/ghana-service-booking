"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
        className="min-h-11 text-callout font-medium text-accent disabled:opacity-60"
      >
        {status === "locating" ? "Finding you…" : "⌖ Near me"}
      </button>
      {status === "denied" ? (
        <span role="status" className="text-footnote text-text-secondary">
          Location is off. Type your area instead, e.g. “in Osu”.
        </span>
      ) : null}
    </div>
  );
}
