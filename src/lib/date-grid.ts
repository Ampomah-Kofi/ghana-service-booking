/**
 * Pure helpers for the month/day picker (docs/design.md: date step). Dates are local
 * `YYYY-MM-DD` strings in the business's timezone; no Date maths on instants.
 */
const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthOption = { key: string; first: string; label: string; year: number };

/** Every month touched by [from, to], e.g. Sep 2026 … Nov 2026. */
export function monthsInRange(from: string, to: string): MonthOption[] {
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: MonthOption[] = [];
  while (y < ty || (y === ty && m <= tm)) {
    out.push({ key: `${y}-${pad(m)}`, first: `${y}-${pad(m)}-01`, label: MONTHS[m - 1], year: y });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The month as calendar cells, Monday first: leading `null`s, then each date. */
export function monthCells(monthKey: string): (string | null)[] {
  const [y, m] = monthKey.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Mon = 0
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let d = 1; d <= daysInMonth(y, m); d += 1) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  return cells;
}

/** Clamp a date into [min, max]. */
export function clampDate(date: string, min: string, max: string): string {
  return date < min ? min : date > max ? max : date;
}
