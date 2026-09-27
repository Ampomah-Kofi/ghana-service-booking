import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money";

const GHS = { code: "GHS", minorUnit: 2, symbol: "GH₵" };

describe("formatMoney", () => {
  it("formats whole cedis without decimals", () => {
    expect(formatMoney({ amountMinor: 5000, currency: "GHS" }, GHS)).toBe("GH₵50");
  });
  it("shows pesewas when present", () => {
    expect(formatMoney({ amountMinor: 5050, currency: "GHS" }, GHS)).toBe("GH₵50.50");
    expect(formatMoney({ amountMinor: 5, currency: "GHS" }, GHS)).toBe("GH₵0.05");
  });
  it("groups thousands", () => {
    expect(formatMoney({ amountMinor: 123456700, currency: "GHS" }, GHS)).toBe("GH₵1,234,567");
  });
  it("handles negatives (refunds)", () => {
    expect(formatMoney({ amountMinor: -2500, currency: "GHS" }, GHS)).toBe("-GH₵25");
  });
  it("works for zero-decimal currencies and falls back to the code", () => {
    expect(formatMoney({ amountMinor: 1500, currency: "RWF" }, { code: "RWF", minorUnit: 0 })).toBe("RWF1,500");
  });
  it("rejects floats and currency mismatches", () => {
    expect(() => formatMoney({ amountMinor: 10.5, currency: "GHS" }, GHS)).toThrow(RangeError);
    expect(() => formatMoney({ amountMinor: 100, currency: "NGN" }, GHS)).toThrow(/mismatch/);
  });
});
