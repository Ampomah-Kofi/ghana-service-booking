/**
 * Display helpers. Instants are always shown in the BUSINESS's timezone, so a
 * customer abroad still sees the time on the shop's clock.
 */
const fmt = (timezone: string, options: Intl.DateTimeFormatOptions, locale = "en-GB") =>
  new Intl.DateTimeFormat(locale, { timeZone: timezone, ...options });

/** "14:30" */
export function formatTime(instant: Date | string, timezone: string): string {
  return fmt(timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instant));
}

/** "Monday 1 March" */
export function formatDayLong(instant: Date | string, timezone: string): string {
  return fmt(timezone, { weekday: "long", day: "numeric", month: "long" }).format(new Date(instant));
}

/** "Mon 1 Mar 2027, 14:30" */
export function formatDateTime(instant: Date | string, timezone: string): string {
  return fmt(timezone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

/** Parts for a day-strip pill from a local date (YYYY-MM-DD): { weekday: "Mon", day: "1", month: "Mar" }. */
export function dayPill(date: string): { weekday: string; day: string; month: string } {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const f = (options: Intl.DateTimeFormatOptions) => fmt("UTC", options).format(noonUtc);
  return { weekday: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }) };
}

/** "Monday 1 March" from a local date (YYYY-MM-DD). */
export function formatLocalDate(date: string): string {
  return fmt("UTC", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`));
}
