import { TZDate } from "@date-fns/tz";
import type { HoursRange } from "@/lib/hours";
import { minutesOf } from "@/lib/hours";

/**
 * The scheduling engine (docs/architecture.md §6). Pure: same input, same output,
 * no I/O, so it is unit-tested exhaustively. The database re-checks every booking
 * (book_appointment) and the exclusion constraint has the final word.
 *
 * All wall-clock maths happens in the business's IANA timezone; results are instants.
 */
export type BookingRules = {
  slotIntervalMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

export type StaffSchedule = { id: string; usesBusinessHours: boolean; hours: HoursRange[] };

export type BusyInterval = { staffId: string; start: Date; end: Date; kind: "appointment" | "block" };

export type AvailabilityInput = {
  timezone: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  now: Date;
  rules: BookingRules;
  durationMinutes: number;
  businessHours: HoursRange[];
  /** Staff who can do this service, in the business's display order. */
  staff: StaffSchedule[];
  busy: BusyInterval[];
};

export type Slot = { start: Date; staffIds: string[] };

type MinuteRange = { from: number; to: number };

/** ISO weekday (1 = Monday) of a local calendar date. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Local wall-clock time (minutes after local midnight, 1440 = next midnight) → instant. */
export function localToInstant(date: string, minutes: number, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0, timezone).getTime());
}

/** The local calendar date (YYYY-MM-DD) of an instant in a timezone. */
export function localDateOf(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function rangesFor(hours: HoursRange[], weekday: number): MinuteRange[] {
  return hours
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ from: minutesOf(h.opens), to: minutesOf(h.closes) }))
    .sort((a, b) => a.from - b.from);
}

/** Overlap of two sorted lists of ranges (business hours ∩ staff hours). */
export function intersectRanges(a: MinuteRange[], b: MinuteRange[]): MinuteRange[] {
  const out: MinuteRange[] = [];
  for (const x of a) {
    for (const y of b) {
      const from = Math.max(x.from, y.from);
      const to = Math.min(x.to, y.to);
      if (to > from) out.push({ from, to });
    }
  }
  return out.sort((p, q) => p.from - q.from);
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

export function availableSlots(input: AvailabilityInput): Slot[] {
  const { rules, durationMinutes: duration, timezone, date } = input;
  const weekday = isoWeekday(date);
  const businessRanges = rangesFor(input.businessHours, weekday);
  const earliest = input.now.getTime() + rules.minNoticeMinutes * 60_000;
  const latest = input.now.getTime() + rules.maxAdvanceDays * 86_400_000;
  const minute = 60_000;

  const byStart = new Map<number, string[]>();
  for (const staff of input.staff) {
    const working = staff.usesBusinessHours
      ? businessRanges
      : intersectRanges(businessRanges, rangesFor(staff.hours, weekday));
    const busy = input.busy.filter((b) => b.staffId === staff.id);
    const appointments = busy
      .filter((b) => b.kind === "appointment")
      .map((b) => [b.start.getTime(), b.end.getTime()] as const);
    const blocks = busy.filter((b) => b.kind === "block").map((b) => [b.start.getTime(), b.end.getTime()] as const);

    for (const range of working) {
      // Grid anchored at the start of each working range: opening at 08:10 offers 08:10, 08:25, …
      for (let t = range.from; t + duration <= range.to; t += rules.slotIntervalMinutes) {
        const start = localToInstant(date, t, timezone).getTime();
        const end = localToInstant(date, t + duration, timezone).getTime();
        // DST: a wall-clock time that doesn't exist (spring forward) maps elsewhere; skip it.
        if (localDateOf(new Date(start), timezone) !== date || end - start !== duration * minute) continue;
        if (start < earliest || start > latest) continue;
        if (blocks.some(([s, e]) => overlaps(start, end, s, e))) continue;
        const occStart = start - rules.bufferBeforeMinutes * minute;
        const occEnd = end + rules.bufferAfterMinutes * minute;
        if (appointments.some(([s, e]) => overlaps(occStart, occEnd, s, e))) continue;
        const list = byStart.get(start) ?? [];
        list.push(staff.id);
        byStart.set(start, list);
      }
    }
  }

  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, staffIds]) => ({ start: new Date(start), staffIds }));
}

/**
 * "Any available professional": fairest first. Fewest booked minutes that day,
 * then the business's display order. Deterministic, so it's testable.
 */
export function orderForAnyAvailable(staffIds: string[], busy: BusyInterval[], displayOrder: string[]): string[] {
  const booked = new Map<string, number>();
  for (const b of busy) {
    if (b.kind !== "appointment") continue;
    booked.set(b.staffId, (booked.get(b.staffId) ?? 0) + (b.end.getTime() - b.start.getTime()));
  }
  return [...staffIds].sort(
    (a, b) => (booked.get(a) ?? 0) - (booked.get(b) ?? 0) || displayOrder.indexOf(a) - displayOrder.indexOf(b),
  );
}

/** Morning / afternoon / evening groups for the time picker (local time). */
export function groupByPartOfDay(slots: Slot[], timezone: string) {
  const hour = (d: Date) =>
    Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(d));
  const groups = { Morning: [] as Slot[], Afternoon: [] as Slot[], Evening: [] as Slot[] };
  for (const slot of slots) {
    const h = hour(slot.start);
    (h < 12 ? groups.Morning : h < 17 ? groups.Afternoon : groups.Evening).push(slot);
  }
  return Object.entries(groups).filter(([, list]) => list.length > 0) as [keyof typeof groups, Slot[]][];
}
