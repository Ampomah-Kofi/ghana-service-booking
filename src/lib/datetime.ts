/**
 * Display formats (docs/design.md §3a): "9:30 am", "Tue, 14 Oct", "Tuesday, 14 October".
 * Instants are always shown in the BUSINESS's timezone, so a customer abroad
 * still sees the time on the shop's clock.
 */
const parts = (instant: Date, timezone: string, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, ...options })
      .formatToParts(instant)
      // ICU writes "Sept" for en-GB; the design uses three-letter months ("Sep").
      .map((p) => [p.type, p.type === "month" && p.value === "Sept" ? "Sep" : p.value]),
  ) as Record<string, string>;

/** "9:30 am" */
export function formatTime(instant: Date | string, timezone: string): string {
  const p = parts(new Date(instant), timezone, { hour: "numeric", minute: "2-digit", hourCycle: "h23" });
  const h = Number(p.hour);
  return `${h % 12 === 0 ? 12 : h % 12}:${p.minute} ${h < 12 ? "am" : "pm"}`;
}

/** "Tue, 14 Oct" */
export function formatDateShort(instant: Date | string, timezone: string): string {
  const p = parts(new Date(instant), timezone, { weekday: "short", day: "numeric", month: "short" });
  return `${p.weekday}, ${p.day} ${p.month}`;
}

/** "Tuesday, 14 October" */
export function formatDayLong(instant: Date | string, timezone: string): string {
  const p = parts(new Date(instant), timezone, { weekday: "long", day: "numeric", month: "long" });
  return `${p.weekday}, ${p.day} ${p.month}`;
}

/** "Tue, 14 Oct · 9:30 am" */
export function formatDateTime(instant: Date | string, timezone: string): string {
  return `${formatDateShort(instant, timezone)} · ${formatTime(instant, timezone)}`;
}

/** A local date (YYYY-MM-DD) as a noon-UTC instant, so date-only formatting never shifts a day. */
const noon = (date: string) => new Date(`${date}T12:00:00Z`);

/** Parts for a day-strip pill: { weekday: "Mon", day: "1", month: "Mar" }. */
export function dayPill(date: string): { weekday: string; day: string; month: string } {
  const p = parts(noon(date), "UTC", { weekday: "short", day: "numeric", month: "short" });
  return { weekday: p.weekday, day: p.day, month: p.month };
}

/** "Tuesday, 14 October" from a local date. */
export function formatLocalDate(date: string): string {
  return formatDayLong(noon(date), "UTC");
}

/** "Tue, 14 Oct" from a local date. */
export function formatLocalDateShort(date: string): string {
  return formatDateShort(noon(date), "UTC");
}

/** "October 2026" from a local date. */
export function formatMonthYear(date: string): string {
  const p = parts(noon(date), "UTC", { month: "long", year: "numeric" });
  return `${p.month} ${p.year}`;
}
