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

/** Wall-clock "HH:MM" → "9:30 am" (docs/design.md §3a). "24:00" is midnight. */
export function formatClock(time: string): string {
  const minutes = minutesOf(time) % 1440;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Groups a week for display: [{ day, label, ranges: ["9:00 am – 1:00 pm", …] }]. Closed days have no ranges. */
export function describeWeek(ranges: HoursRange[]) {
  return WEEKDAYS.map(({ day, long }) => ({
    day,
    label: long,
    ranges: ranges
      .filter((r) => r.weekday === day)
      .sort((a, b) => minutesOf(a.opens) - minutesOf(b.opens))
      .map((r) => `${formatClock(r.opens)} – ${formatClock(r.closes)}`),
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

/**
 * "Open · closes 8:00 pm" / "Closed · opens Tue 9:00 am" in the business's timezone.
 * `open` drives the green/grey dot; the label is always there too (never colour alone).
 */
export function openStatus(
  hours: HoursRange[],
  timezone: string,
  now = new Date(),
): { open: boolean; label: string } | null {
  if (hours.length === 0) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const today = WEEKDAYS.findIndex((d) => d.short === parts.weekday) + 1;
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const ranges = (day: number) =>
    hours.filter((h) => h.weekday === day).sort((a, b) => minutesOf(a.opens) - minutesOf(b.opens));

  const current = ranges(today).find((r) => minutesOf(r.opens) <= minute && minute < minutesOf(r.closes));
  if (current) return { open: true, label: `Open · closes ${formatClock(current.closes)}` };

  const laterToday = ranges(today).find((r) => minutesOf(r.opens) > minute);
  if (laterToday) return { open: false, label: `Closed · opens ${formatClock(laterToday.opens)}` };
  for (let i = 1; i <= 7; i++) {
    const day = ((today - 1 + i) % 7) + 1;
    const first = ranges(day)[0];
    if (first) {
      const when = i === 1 ? "tomorrow" : WEEKDAYS[day - 1].short;
      return { open: false, label: `Closed · opens ${when} ${formatClock(first.opens)}` };
    }
  }
  return null;
}
