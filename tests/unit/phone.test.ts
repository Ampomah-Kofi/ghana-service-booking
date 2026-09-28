import { describe, expect, it } from "vitest";
import { e164ToAuthPhone, formatPhoneInternational, formatPhoneLocal, parsePhone } from "@/lib/phone";

describe("parsePhone", () => {
  it.each([
    ["024 123 4567", "+233241234567"],
    ["0241234567", "+233241234567"],
    ["+233 24 123 4567", "+233241234567"],
    ["233241234567", "+233241234567"],
    ["  020-000-0001 ", "+233200000001"],
    ["055 123 4567", "+233551234567"],
  ])("parses Ghanaian input %s", (input, expected) => {
    expect(parsePhone(input, "GH")).toEqual({ ok: true, e164: expected, country: "GH" });
  });

  it("parses international numbers regardless of default country", () => {
    expect(parsePhone("+44 20 7946 0958", "GH")).toMatchObject({ ok: true, e164: "+442079460958", country: "GB" });
  });

  it("uses the default country for national formats (not Ghana-only)", () => {
    expect(parsePhone("0803 123 4567", "NG")).toMatchObject({ ok: true, e164: "+2348031234567" });
  });

  it.each(["", "123", "024 123", "not a phone", "+233 99 999 9999 9999", "0".repeat(40)])("rejects %j", (input) => {
    expect(parsePhone(input, "GH")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("phone helpers", () => {
  it("formats E.164 for display", () => {
    expect(formatPhoneInternational("+233241234567")).toBe("+233 24 123 4567");
  });
  it("formats numbers the way people write them at home (prefills Mobile Money)", () => {
    expect(formatPhoneLocal("+233241234567")).toBe("024 123 4567");
  });
  it("strips + for Supabase Auth", () => {
    expect(e164ToAuthPhone("+233241234567")).toBe("233241234567");
  });
});
