import { describe, expect, it } from "vitest";
import { clampDate, daysInMonth, monthCells, monthsInRange } from "@/lib/date-grid";

describe("date grid", () => {
  it("lists months across a year end", () => {
    expect(monthsInRange("2026-11-20", "2027-02-03").map((m) => `${m.label} ${m.year}`)).toEqual([
      "Nov 2026",
      "Dec 2026",
      "Jan 2027",
      "Feb 2027",
    ]);
    expect(monthsInRange("2026-09-28", "2026-09-30")).toHaveLength(1);
  });

  it("lays a month out Monday first", () => {
    const cells = monthCells("2026-09"); // 1 Sep 2026 is a Tuesday
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe("2026-09-01");
    expect(cells.at(-1)).toBe("2026-09-30");
    expect(monthCells("2026-06")[0]).toBe("2026-06-01"); // a Monday
  });

  it("knows leap years", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it("clamps", () => {
    expect(clampDate("2026-09-01", "2026-09-28", "2026-12-01")).toBe("2026-09-28");
    expect(clampDate("2027-01-01", "2026-09-28", "2026-12-01")).toBe("2026-12-01");
  });
});
