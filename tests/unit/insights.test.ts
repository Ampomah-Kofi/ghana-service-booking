import { describe, expect, it } from "vitest";
import { bucketPerDay, parsePeriod, withRates } from "@/server/businesses/insights";

const day = (i: number) => ({ day: `2026-09-${String(i).padStart(2, "0")}`, bookings: i, completed: 1 });

describe("insights helpers", () => {
  it("only offers 7, 30 or 90 days", () => {
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod("45")).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
  });

  it("folds days into weeks, keeping the most recent week whole", () => {
    const days = Array.from({ length: 10 }, (_, i) => day(i + 1));
    const weeks = bucketPerDay(days, 7);
    expect(weeks.map((w) => w.day)).toEqual(["2026-09-01", "2026-09-04"]);
    expect(weeks.map((w) => w.bookings)).toEqual([1 + 2 + 3, 4 + 5 + 6 + 7 + 8 + 9 + 10]);
    expect(bucketPerDay(days, 1)).toBe(days);
  });

  it("works out cancellation and no-show rates without dividing by zero", () => {
    const base = {
      days: 7,
      from: "2026-09-22",
      to: "2026-09-28",
      timezone: "Africa/Accra",
      currency: "GHS",
      by_source: {},
      per_day: [],
      completed_value_minor: 0,
      recorded_minor: 0,
      refunded_minor: 0,
      top_services: [],
      top_staff: [],
      customers: { total: 0, new: 0, returning: 0 },
    };
    const r = withRates({ ...base, bookings: 10, by_status: { completed: 6, no_show: 2, cancelled: 2 } });
    expect(r.cancellationRate).toBe(0.2);
    expect(r.noShowRate).toBe(0.25);
    expect(withRates({ ...base, bookings: 0, by_status: {} })).toMatchObject({
      cancellationRate: null,
      noShowRate: null,
    });
  });
});
