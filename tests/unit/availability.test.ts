import { describe, expect, it } from "vitest";
import {
  addDays,
  availableSlots,
  groupByPartOfDay,
  intersectRanges,
  isoWeekday,
  localDateOf,
  localToInstant,
  orderForAnyAvailable,
  type AvailabilityInput,
} from "@/lib/availability";

const ACCRA = "Africa/Accra"; // UTC+0, no DST
const rules = {
  slotIntervalMinutes: 30,
  minNoticeMinutes: 0,
  maxAdvanceDays: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
};
const MONDAY = "2027-03-01";
const hhmm = (d: Date, tz = ACCRA) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

function base(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    timezone: ACCRA,
    date: MONDAY,
    now: new Date("2027-02-28T12:00:00Z"),
    rules,
    durationMinutes: 60,
    businessHours: [{ weekday: 1, opens: "09:00", closes: "12:00" }],
    staff: [{ id: "kwame", usesBusinessHours: true, hours: [] }],
    busy: [],
    ...overrides,
  };
}
const times = (input: AvailabilityInput) => availableSlots(input).map((s) => hhmm(s.start));

describe("date helpers", () => {
  it("knows ISO weekdays and adds days across months", () => {
    expect(isoWeekday("2027-03-01")).toBe(1);
    expect(isoWeekday("2027-03-07")).toBe(7);
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });
  it("converts local wall-clock time to instants in the business timezone", () => {
    expect(localToInstant(MONDAY, 9 * 60, ACCRA).toISOString()).toBe("2027-03-01T09:00:00.000Z");
    expect(localToInstant(MONDAY, 9 * 60, "Africa/Lagos").toISOString()).toBe("2027-03-01T08:00:00.000Z");
    expect(localToInstant(MONDAY, 1440, ACCRA).toISOString()).toBe("2027-03-02T00:00:00.000Z");
    expect(localDateOf(new Date("2027-03-01T23:30:00Z"), "Africa/Lagos")).toBe("2027-03-02");
  });
  it("intersects business and staff hours", () => {
    expect(
      intersectRanges(
        [{ from: 540, to: 1080 }],
        [
          { from: 600, to: 720 },
          { from: 900, to: 1200 },
        ],
      ),
    ).toEqual([
      { from: 600, to: 720 },
      { from: 900, to: 1080 },
    ]);
  });
});

describe("availableSlots", () => {
  it("offers a start every interval where the whole service fits", () => {
    expect(times(base())).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });
  it("anchors the grid at the opening time", () => {
    expect(times(base({ businessHours: [{ weekday: 1, opens: "08:10", closes: "09:40" }] }))).toEqual([
      "08:10",
      "08:40",
    ]);
  });
  it("respects lunch breaks (split shifts)", () => {
    const hours = [
      { weekday: 1, opens: "09:00", closes: "12:00" },
      { weekday: 1, opens: "13:00", closes: "15:00" },
    ];
    expect(times(base({ businessHours: hours }))).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "13:00",
      "13:30",
      "14:00",
    ]);
  });
  it("is closed on days without hours", () => {
    expect(times(base({ date: "2027-03-02" }))).toEqual([]);
  });
  it("uses the staff member's own hours inside business hours", () => {
    const staff = [{ id: "efua", usesBusinessHours: false, hours: [{ weekday: 1, opens: "10:00", closes: "18:00" }] }];
    expect(times(base({ staff }))).toEqual(["10:00", "10:30", "11:00"]);
  });
  it("skips existing appointments, including their buffers", () => {
    const busy = [
      {
        staffId: "kwame",
        start: new Date("2027-03-01T10:00:00Z"),
        end: new Date("2027-03-01T10:30:00Z"),
        kind: "appointment" as const,
      },
    ];
    expect(times(base({ busy }))).toEqual(["09:00", "10:30", "11:00"]);
    // With a 15-minute clean-up, the database reports the other booking's occupied
    // range (10:00–10:45). 09:00 is out too: its own clean-up would run into 10:00.
    const occupied = [{ ...busy[0], end: new Date("2027-03-01T10:45:00Z") }];
    expect(times(base({ busy: occupied, rules: { ...rules, bufferAfterMinutes: 15 } }))).toEqual(["11:00"]);
  });
  it("lets a booking end exactly when the next one starts", () => {
    const busy = [
      {
        staffId: "kwame",
        start: new Date("2027-03-01T10:00:00Z"),
        end: new Date("2027-03-01T11:00:00Z"),
        kind: "appointment" as const,
      },
    ];
    expect(times(base({ busy }))).toContain("09:00");
    expect(times(base({ busy }))).toContain("11:00");
  });
  it("skips time off for that person or the whole business", () => {
    const block = {
      start: new Date("2027-03-01T09:00:00Z"),
      end: new Date("2027-03-01T10:00:00Z"),
      kind: "block" as const,
    };
    expect(times(base({ busy: [{ ...block, staffId: "kwame" }] }))).toEqual(["10:00", "10:30", "11:00"]);
  });
  it("applies minimum notice and the booking window", () => {
    expect(times(base({ now: new Date("2027-03-01T09:40:00Z"), rules: { ...rules, minNoticeMinutes: 60 } }))).toEqual([
      "11:00",
    ]);
    expect(times(base({ now: new Date("2026-12-01T00:00:00Z"), rules: { ...rules, maxAdvanceDays: 30 } }))).toEqual([]);
  });
  it("lists which people are free at each time ('any available')", () => {
    const staff = [
      { id: "ama", usesBusinessHours: true, hours: [] },
      { id: "efua", usesBusinessHours: true, hours: [] },
    ];
    const busy = [
      {
        staffId: "ama",
        start: new Date("2027-03-01T09:00:00Z"),
        end: new Date("2027-03-01T10:00:00Z"),
        kind: "appointment" as const,
      },
    ];
    const slots = availableSlots(base({ staff, busy }));
    expect(slots.find((s) => hhmm(s.start) === "09:00")?.staffIds).toEqual(["efua"]);
    expect(slots.find((s) => hhmm(s.start) === "10:00")?.staffIds).toEqual(["ama", "efua"]);
  });
  it("works in other timezones, including across a DST change", () => {
    // Europe/London springs forward on 2027-03-28: 01:00 → 02:00 doesn't exist.
    const input = base({
      timezone: "Europe/London",
      date: "2027-03-28",
      now: new Date("2027-03-20T00:00:00Z"),
      durationMinutes: 30,
      businessHours: [{ weekday: 7, opens: "00:00", closes: "03:00" }],
    });
    const london = availableSlots(input).map((s) => hhmm(s.start, "Europe/London"));
    expect(london).not.toContain("01:00");
    expect(london).not.toContain("01:30");
    expect(london).toContain("00:00");
    expect(london).toContain("02:30");
  });
});

describe("orderForAnyAvailable and grouping", () => {
  it("prefers whoever has the fewest booked minutes, then display order", () => {
    const busy = [
      {
        staffId: "ama",
        start: new Date("2027-03-01T09:00:00Z"),
        end: new Date("2027-03-01T11:00:00Z"),
        kind: "appointment" as const,
      },
      {
        staffId: "efua",
        start: new Date("2027-03-01T09:00:00Z"),
        end: new Date("2027-03-01T10:00:00Z"),
        kind: "appointment" as const,
      },
      {
        staffId: "kofi",
        start: new Date("2027-03-01T09:00:00Z"),
        end: new Date("2027-03-01T17:00:00Z"),
        kind: "block" as const,
      },
    ];
    expect(orderForAnyAvailable(["ama", "efua", "kofi"], busy, ["ama", "efua", "kofi"])).toEqual([
      "kofi",
      "efua",
      "ama",
    ]);
    expect(orderForAnyAvailable(["b", "a"], [], ["a", "b"])).toEqual(["a", "b"]);
  });
  it("groups times into morning, afternoon and evening", () => {
    const slots = ["09:00", "13:00", "18:30"].map((t) => ({ start: new Date(`2027-03-01T${t}:00Z`), staffIds: ["x"] }));
    expect(groupByPartOfDay(slots, ACCRA).map(([name, list]) => [name, list.length])).toEqual([
      ["Morning", 1],
      ["Afternoon", 1],
      ["Evening", 1],
    ]);
  });
});

describe("display formats", () => {
  it("uses 12-hour times and short dates in the business timezone", async () => {
    const { formatTime, formatDateShort, formatDateTime, formatLocalDate } = await import("@/lib/datetime");
    const t = new Date("2027-03-01T13:05:00Z");
    expect(formatTime(t, ACCRA)).toBe("1:05 pm");
    expect(formatTime(new Date("2027-03-01T00:30:00Z"), ACCRA)).toBe("12:30 am");
    expect(formatTime(t, "Africa/Lagos")).toBe("2:05 pm");
    expect(formatDateShort(t, ACCRA)).toBe("Mon, 1 Mar");
    expect(formatDateTime(t, ACCRA)).toBe("Mon, 1 Mar · 1:05 pm");
    expect(formatLocalDate("2027-03-01")).toBe("Monday, 1 March");
  });
});
