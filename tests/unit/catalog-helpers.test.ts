import { describe, expect, it } from "vitest";
import { checkedOf, listOf, valueOf } from "@/lib/form-values";
import { describeWeek, formatDuration, validateWeek } from "@/lib/hours";
import { minorToInput, parseMoneyInput } from "@/lib/money";
import { blockedTimeSchema, serviceSchema, weekHoursSchema } from "@/schemas/catalog";
import { parseTimeRange } from "@/server/businesses/team";

describe("parseMoneyInput / minorToInput", () => {
  it.each([
    ["50", 5000],
    ["50.5", 5050],
    ["49.99", 4999],
    ["1,200", 120000],
    ["GH₵ 80", 8000],
    ["0", 0],
  ])("%j → %i pesewas", (input, minor) => {
    expect(parseMoneyInput(input, 2)).toBe(minor);
  });
  it.each(["", "abc", "1.234", "-5", "5.5.5", "1e3"])("rejects %j", (input) => {
    expect(parseMoneyInput(input, 2)).toBeNull();
  });
  it("round-trips for editing", () => {
    expect(minorToInput(5000, 2)).toBe("50");
    expect(minorToInput(5050, 2)).toBe("50.50");
    expect(minorToInput(1500, 0)).toBe("1500");
  });
});

describe("weekly hours", () => {
  it("accepts split shifts and midnight closing", () => {
    expect(
      validateWeek([
        { weekday: 1, opens: "09:00", closes: "12:00" },
        { weekday: 1, opens: "13:00", closes: "18:00" },
        { weekday: 7, opens: "18:00", closes: "24:00" },
      ]),
    ).toBeNull();
  });
  it("explains overlaps, reversed times and odd minutes", () => {
    expect(
      validateWeek([
        { weekday: 2, opens: "09:00", closes: "13:00" },
        { weekday: 2, opens: "12:00", closes: "18:00" },
      ]),
    ).toBe("Tuesday: the times overlap.");
    expect(validateWeek([{ weekday: 3, opens: "18:00", closes: "09:00" }])).toBe(
      "Wednesday: closing time must be after opening time.",
    );
    expect(validateWeek([{ weekday: 3, opens: "09:07", closes: "10:00" }])).toBe("Use times in 5-minute steps.");
  });
  it("describes the week in order with closed days", () => {
    const week = describeWeek([
      { weekday: 1, opens: "13:00", closes: "18:00" },
      { weekday: 1, opens: "09:00", closes: "12:00" },
    ]);
    expect(week[0]).toEqual({ day: 1, label: "Monday", ranges: ["09:00–12:00", "13:00–18:00"] });
    expect(week[6]).toEqual({ day: 7, label: "Sunday", ranges: [] });
  });
  it("parses Postgres range text", () => {
    expect(parseTimeRange("[09:00:00,13:00:00)")).toEqual({ opens: "09:00", closes: "13:00" });
    expect(parseTimeRange("[18:00:00,24:00:00)")).toEqual({ opens: "18:00", closes: "24:00" });
    expect(parseTimeRange("garbage")).toBeNull();
  });
  it("validates the hidden JSON field", () => {
    expect(weekHoursSchema.safeParse('[{"weekday":1,"opens":"09:00","closes":"18:00"}]').success).toBe(true);
    expect(weekHoursSchema.safeParse("not json").success).toBe(false);
    expect(weekHoursSchema.safeParse('[{"weekday":9,"opens":"09:00","closes":"18:00"}]').success).toBe(false);
  });
  it("formats durations", () => {
    expect([formatDuration(45), formatDuration(60), formatDuration(150)]).toEqual(["45 min", "1 hr", "2 hr 30 min"]);
  });
});

describe("serviceSchema", () => {
  const schema = serviceSchema(2);
  const base = {
    name: "Low cut",
    description: "",
    price: "50",
    priceType: "fixed",
    durationMinutes: "30",
    deposit: "",
    isActive: "on",
    staffIds: [],
  };
  it("converts prices to pesewas and blanks optional fields", () => {
    expect(schema.parse(base)).toMatchObject({
      price: 5000,
      deposit: null,
      description: null,
      isActive: true,
      durationMinutes: 30,
    });
  });
  it("rejects bad prices, deposits above price and odd durations", () => {
    expect(schema.safeParse({ ...base, price: "" }).error?.issues[0]).toMatchObject({
      path: ["price"],
      message: "Enter a price.",
    });
    expect(schema.safeParse({ ...base, deposit: "60" }).error?.issues[0].path).toEqual(["deposit"]);
    expect(schema.safeParse({ ...base, durationMinutes: "33" }).success).toBe(false);
    expect(schema.safeParse({ ...base, price: "12.345" }).success).toBe(false);
  });
});

describe("blockedTimeSchema", () => {
  it("turns all-day ranges into [start 00:00, day after end 00:00)", () => {
    expect(
      blockedTimeSchema.parse({
        staffId: "all",
        allDay: "on",
        startDate: "2026-12-24",
        endDate: "2026-12-26",
        reason: "",
      }),
    ).toEqual({
      staffId: null,
      reason: null,
      startsLocal: "2026-12-24T00:00",
      endsLocal: "2026-12-27T00:00",
    });
  });
  it("uses times when not all day, and rejects end before start", () => {
    expect(
      blockedTimeSchema.parse({
        staffId: "",
        startDate: "2026-12-24",
        startTime: "12:00",
        endDate: "2026-12-24",
        endTime: "14:00",
        reason: "Lunch",
      }),
    ).toMatchObject({ startsLocal: "2026-12-24T12:00", endsLocal: "2026-12-24T14:00", reason: "Lunch" });
    expect(
      blockedTimeSchema.safeParse({
        staffId: "",
        startDate: "2026-12-24",
        startTime: "14:00",
        endDate: "2026-12-24",
        endTime: "12:00",
        reason: "",
      }).success,
    ).toBe(false);
  });
});

describe("form refill helpers", () => {
  it("prefers submitted values and treats absent checkboxes as unchecked after a submit", () => {
    expect(valueOf(undefined, "name", "default")).toBe("default");
    expect(valueOf({ name: "Typed" }, "name", "default")).toBe("Typed");
    expect(checkedOf(undefined, "isActive", true)).toBe(true);
    expect(checkedOf({ name: "x" }, "isActive", true)).toBe(false);
    expect(listOf({ staffIds: "a" }, "staffIds", ["b"])).toEqual(["a"]);
    expect(listOf({ staffIds: ["a", "c"] }, "staffIds", [])).toEqual(["a", "c"]);
  });
});
