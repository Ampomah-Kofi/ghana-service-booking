import { describe, expect, it } from "vitest";
import {
  addMonths,
  minuteOfDay,
  monthGrid,
  nowLine,
  placeInColumn,
  visibleWindow,
  weekOf,
} from "@/lib/calendar-layout";

const ACCRA = "Africa/Accra";
const DAY = "2027-03-01"; // a Monday
const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00Z`); // Accra is UTC+0

describe("calendar layout", () => {
  it("measures minutes in the business timezone and clamps to the day", () => {
    expect(minuteOfDay(at("09:30"), DAY, ACCRA)).toBe(570);
    expect(minuteOfDay(at("09:30"), DAY, "Africa/Lagos")).toBe(630);
    expect(minuteOfDay(new Date("2027-02-28T23:00:00Z"), DAY, ACCRA)).toBe(0);
    expect(minuteOfDay(new Date("2027-03-02T02:00:00Z"), DAY, ACCRA)).toBe(1440);
  });

  it("shows opening hours, widened for bookings outside them", () => {
    expect(visibleWindow([{ from: 540, to: 1080 }], [])).toEqual({ from: 540, to: 1080 });
    expect(visibleWindow([{ from: 540, to: 1080 }], [{ from: 1250, to: 1280 }])).toEqual({ from: 540, to: 1320 });
    expect(visibleWindow([{ from: 545, to: 1075 }], [])).toEqual({ from: 540, to: 1080 });
    expect(visibleWindow([], [])).toEqual({ from: 480, to: 1080 });
  });

  it("positions items and puts overlapping ones side by side", () => {
    const window = { from: 540, to: 1080 };
    const placed = placeInColumn(
      [
        { id: "a", start: at("09:00"), end: at("10:00") },
        { id: "b", start: at("09:30"), end: at("10:30") },
        { id: "c", start: at("11:00"), end: at("11:05") },
      ],
      DAY,
      ACCRA,
      window,
      1.5,
    );
    expect(placed.map((p) => [p.id, p.top, p.height, p.lane, p.lanes])).toEqual([
      ["a", 0, 90, 0, 2],
      ["b", 45, 90, 1, 2],
      ["c", 180, 15, 0, 1], // short items get a readable minimum height
    ]);
  });

  it("builds weeks from Monday and 6-week month grids", () => {
    expect(weekOf("2027-03-03")).toEqual([
      "2027-03-01",
      "2027-03-02",
      "2027-03-03",
      "2027-03-04",
      "2027-03-05",
      "2027-03-06",
      "2027-03-07",
    ]);
    const grid = monthGrid("2027-03-15");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ date: "2027-03-01", inMonth: true });
    expect(grid.filter((d) => d.inMonth)).toHaveLength(31);
    expect(monthGrid("2027-02-10")[0]).toEqual({ date: "2027-02-01", inMonth: true });
    expect(monthGrid("2027-04-10")[0]).toEqual({ date: "2027-03-29", inMonth: false });
  });

  it("moves between months without overflowing short months", () => {
    expect(addMonths("2027-03-31", -1)).toBe("2027-02-28");
    expect(addMonths("2027-12-15", 1)).toBe("2028-01-15");
  });

  it("draws the now line only on today inside the window", () => {
    const window = { from: 540, to: 1080 };
    expect(nowLine(at("10:00"), DAY, ACCRA, window, 1)).toBe(60);
    expect(nowLine(at("07:00"), DAY, ACCRA, window, 1)).toBeNull();
    expect(nowLine(new Date("2027-03-02T10:00:00Z"), DAY, ACCRA, window, 1)).toBeNull();
  });
});
