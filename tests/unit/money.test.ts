import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money";

const GHS = { code: "GHS", minorUnit: 2, symbol: "GH₵" };

describe("formatMoney", () => {
  it("formats whole cedis without decimals", () => {
    expect(formatMoney({ amountMinor: 5000, currency: "GHS" }, GHS)).toBe("GH₵ 50");
  });
  it("shows pesewas when present", () => {
    expect(formatMoney({ amountMinor: 5050, currency: "GHS" }, GHS)).toBe("GH₵ 50.50");
    expect(formatMoney({ amountMinor: 5, currency: "GHS" }, GHS)).toBe("GH₵ 0.05");
  });
  it("groups thousands", () => {
    expect(formatMoney({ amountMinor: 123456700, currency: "GHS" }, GHS)).toBe("GH₵ 1,234,567");
  });
  it("handles negatives (refunds)", () => {
    expect(formatMoney({ amountMinor: -2500, currency: "GHS" }, GHS)).toBe("-GH₵ 25");
  });
  it("works for zero-decimal currencies and falls back to the code", () => {
    expect(formatMoney({ amountMinor: 1500, currency: "RWF" }, { code: "RWF", minorUnit: 0 })).toBe("RWF 1,500");
  });
  it("rejects floats and currency mismatches", () => {
    expect(() => formatMoney({ amountMinor: 10.5, currency: "GHS" }, GHS)).toThrow(RangeError);
    expect(() => formatMoney({ amountMinor: 100, currency: "NGN" }, GHS)).toThrow(/mismatch/);
  });
});

describe("formatPrice", () => {
  it("shows on-request services without an amount", async () => {
    const { formatPrice } = await import("@/lib/money");
    const ghs = { code: "GHS", symbol: "GH₵", minorUnit: 2 };
    expect(formatPrice(0, "on_request", ghs)).toBe("Price on request");
    expect(formatPrice(8000, "from", ghs)).toBe("From GH₵ 80");
    expect(formatPrice(8000, "fixed", ghs)).toBe("GH₵ 80");
  });
});
