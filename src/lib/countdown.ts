/** Label for the provider's "Next up" card: "Up next · in 25 min", then "Happening now". */
export function countdownLabel(start: Date, now: Date): string {
  const minutes = Math.ceil((start.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "Happening now";
  if (minutes < 60) return `Up next · in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Up next · in ${hours} hr${rest === 0 ? "" : ` ${rest} min`}`;
}
