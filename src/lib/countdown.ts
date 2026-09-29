/** Label for the provider's "Next up" card: "Up next · in 25 min", then "Happening now". */
export function countdownLabel(start: Date, now: Date): string {
  const minutes = Math.ceil((start.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "Happening now";
  if (minutes < 60) return `Up next · in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Up next · in ${hours} hr${rest === 0 ? "" : ` ${rest} min`}`;
}

/** The pill on the card: "in 25 min", "in 1 hr 5 min", "20 min left", "Running over". */
export function countdownShort(start: Date, end: Date, now: Date): string {
  const toStart = Math.ceil((start.getTime() - now.getTime()) / 60_000);
  if (toStart > 0) {
    if (toStart < 60) return `in ${toStart} min`;
    const h = Math.floor(toStart / 60);
    const m = toStart % 60;
    return `in ${h} hr${m ? ` ${m} min` : ""}`;
  }
  const left = Math.ceil((end.getTime() - now.getTime()) / 60_000);
  return left > 0 ? `${left} min left` : "Running over";
}

/** How far through the appointment we are, 0–1 (0 before it starts). */
export function progressThrough(start: Date, end: Date, now: Date): number {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / total));
}
