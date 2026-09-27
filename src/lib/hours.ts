/**
 * Weekly opening hours as wall-clock ranges (business timezone). ISO weekdays: 1 = Monday.
 * Shared by the editor (browser) and the pages that display hours.
 */
export type HoursRange = { weekday: number; opens: string; closes: string };

export const WEEKDAYS = [
  { day: 1, short: "Mon", long: "Monday" },
  { day: 2, short: "Tue", long: "Tuesday" },
  { day: 3, short: "Wed", long: "Wednesday" },
  { day: 4, short: "Thu", long: "Thursday" },
  { day: 5, short: "Fri", long: "Friday" },
  { day: 6, short: "Sat", long: "Saturday" },
  { day: 7, short: "Sun", long: "Sunday" },
] as const;

/** "09:00:00" → "09:00"; "24:00:00" stays "24:00". */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Returns a user-facing problem with the week, or null when it's valid. Mirrors the SQL checks. */
export function validateWeek(ranges: HoursRange[]): string | null {
  for (const r of ranges) {
    if (!/^\d{2}:\d{2}$/.test(r.opens) || !/^\d{2}:\d{2}$/.test(r.closes)) return "Use times like 09:00.";
    if (minutesOf(r.opens) % 5 !== 0 || minutesOf(r.closes) % 5 !== 0) return "Use times in 5-minute steps.";
    if (minutesOf(r.closes) <= minutesOf(r.opens)) {
      return `${WEEKDAYS[r.weekday - 1]?.long ?? "A day"}: closing time must be after opening time.`;
    }
  }
  for (const { day, long } of WEEKDAYS) {
    const sorted = ranges.filter((r) => r.weekday === day).sort((a, b) => minutesOf(a.opens) - minutesOf(b.opens));
    for (let i = 1; i < sorted.length; i++) {
      if (minutesOf(sorted[i].opens) < minutesOf(sorted[i - 1].closes)) return `${long}: the times overlap.`;
    }
  }
  return null;
}

/** Groups a week for display: [{ day, label, ranges: ["09:00–13:00", …] }]. Closed days have no ranges. */
export function describeWeek(ranges: HoursRange[]) {
  return WEEKDAYS.map(({ day, long }) => ({
    day,
    label: long,
    ranges: ranges
      .filter((r) => r.weekday === day)
      .sort((a, b) => minutesOf(a.opens) - minutesOf(b.opens))
      .map((r) => `${hhmm(r.opens)}–${hhmm(r.closes)}`),
  }));
}

/** Service durations offered in the picker (minutes). */
export const DURATION_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 600, 720,
];

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
