import { addDays, isoWeekday, localDateOf, localToInstant } from "@/lib/availability";

/**
 * Pure layout maths for the provider calendar (no I/O, unit-tested).
 * Positions are minutes since local midnight in the business's timezone.
 */
export type TimedItem = { id: string; start: Date; end: Date };
export type Placed<T> = T & { top: number; height: number; lane: number; lanes: number };
export type MinuteRange = { from: number; to: number };

/** Minutes since local midnight of `date`, clamped to the day (items crossing midnight are cut). */
export function minuteOfDay(instant: Date, date: string, timezone: string): number {
  const dayStart = localToInstant(date, 0, timezone).getTime();
  const dayEnd = localToInstant(date, 1440, timezone).getTime();
  const t = Math.min(Math.max(instant.getTime(), dayStart), dayEnd);
  // Minutes are measured in wall-clock terms: on a DST day the day is 23 or 25 hours long.
  return Math.round(((t - dayStart) / (dayEnd - dayStart)) * 1440);
}

/**
 * Visible hours for a day: opening hours, widened to include any booking outside them,
 * snapped to whole hours. Defaults to 8 am – 6 pm on a closed day with nothing booked.
 */
export function visibleWindow(open: MinuteRange[], items: MinuteRange[]): MinuteRange {
  const all = [...open, ...items];
  if (all.length === 0) return { from: 8 * 60, to: 18 * 60 };
  const from = Math.min(...all.map((r) => r.from));
  const to = Math.max(...all.map((r) => r.to));
  return { from: Math.floor(from / 60) * 60, to: Math.min(1440, Math.ceil(to / 60) * 60) };
}

/**
 * Places items in one column: vertical position from time, and side-by-side lanes when
 * items overlap (e.g. a block over a booking made with an override). Stable and deterministic.
 */
export function placeInColumn<T extends TimedItem>(
  items: T[],
  date: string,
  timezone: string,
  window: MinuteRange,
  pxPerMinute: number,
): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id));
  const placed: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    for (const p of cluster) p.lanes = lanes;
    cluster = [];
    laneEnds.length = 0;
  };

  for (const item of sorted) {
    const from = minuteOfDay(item.start, date, timezone);
    const to = Math.max(from + 10, minuteOfDay(item.end, date, timezone)); // at least 10 minutes tall
    if (from >= clusterEnd && cluster.length > 0) closeCluster();
    let lane = laneEnds.findIndex((end) => end <= from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = to;
    clusterEnd = Math.max(clusterEnd, to);
    const p = {
      ...item,
      top: (from - window.from) * pxPerMinute,
      height: (to - from) * pxPerMinute,
      lane,
      lanes: 1,
    };
    cluster.push(p);
    placed.push(p);
  }
  if (cluster.length > 0) closeCluster();
  return placed;
}

/** The Monday-to-Sunday week containing `date`. */
export function weekOf(date: string): string[] {
  const monday = addDays(date, 1 - isoWeekday(date));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** A month grid: 6 rows × 7 days, Monday first, including days of the neighbouring months. */
export function monthGrid(date: string): { date: string; inMonth: boolean }[] {
  const first = `${date.slice(0, 7)}-01`;
  const start = addDays(first, 1 - isoWeekday(first));
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(start, i);
    return { date: d, inMonth: d.slice(0, 7) === date.slice(0, 7) };
  });
}

/** Same day of month in the previous/next month, clamped (31 Mar → 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Where the "now" line goes, or null when now isn't inside the visible window of that day. */
export function nowLine(now: Date, date: string, timezone: string, window: MinuteRange, pxPerMinute: number) {
  if (localDateOf(now, timezone) !== date) return null;
  const m = minuteOfDay(now, date, timezone);
  return m < window.from || m > window.to ? null : (m - window.from) * pxPerMinute;
}
