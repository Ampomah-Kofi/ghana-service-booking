import { describe, expect, it } from "vitest";
import { acceptedSummary, paymentReference } from "@/lib/payment-methods";
import { acceptedMethodsSchema, paymentDetailsSchema, recordPaymentSchema } from "@/schemas/payments";

describe("payment methods (ADR-0017: paid directly to the business)", () => {
  it("summarises accepted methods in a fixed order", () => {
    expect(acceptedSummary(["bank_transfer", "cash", "mobile_money"])).toBe("Cash · MoMo · Bank");
    expect(acceptedSummary(["card"])).toBe("Card");
  });

  it("makes a short transfer reference from the booking id", () => {
    expect(paymentReference("3c9ac928-5d16-4679-b971-e31f44d83042")).toBe("BK-3C9AC9");
  });

  it("needs at least one accepted method and drops repeats", () => {
    expect(acceptedMethodsSchema.safeParse([]).success).toBe(false);
    expect(acceptedMethodsSchema.parse(["cash", "cash", "card"])).toEqual(["cash", "card"]);
    expect(acceptedMethodsSchema.safeParse(["cheque"]).success).toBe(false);
  });
});

describe("paymentDetailsSchema", () => {
  const schema = paymentDetailsSchema("GH");
  it("accepts Mobile Money only, stored as E.164", () => {
    expect(schema.parse({ momoNetwork: "mtn", momoNumber: "024 111 2233", momoName: "Kwame Asante" })).toEqual({
      momo: { network: "mtn", phone: "+233241112233", name: "Kwame Asante" },
      bank: null,
    });
  });
  it("accepts a bank account with spaces removed", () => {
    expect(
      schema.parse({ bankName: "GCB Bank", bankAccountName: "Kwame Cuts", bankAccountNumber: "1234 5678 9012" }).bank,
    ).toEqual({ bankName: "GCB Bank", accountName: "Kwame Cuts", accountNumber: "123456789012" });
  });
  it("points at the field that's wrong", () => {
    const r = schema.safeParse({ momoNetwork: "mtn", momoNumber: "123", momoName: "K" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["momoNumber", "momoName"]);
  });
  it("both sides empty means remove the details", () => {
    expect(schema.parse({ momoNetwork: "mtn", momoNumber: "", momoName: "" })).toEqual({ momo: null, bank: null });
  });
});

describe("recordPaymentSchema", () => {
  const schema = recordPaymentSchema(2);
  it("parses the amount into pesewas without floats", () => {
    expect(schema.parse({ method: "mobile_money", amount: "30.50" })).toEqual({
      method: "mobile_money",
      amount: 3050,
      note: null,
    });
  });
  it("refuses zero, junk and unknown methods", () => {
    expect(schema.safeParse({ method: "cash", amount: "0" }).success).toBe(false);
    expect(schema.safeParse({ method: "cash", amount: "abc" }).success).toBe(false);
    expect(schema.safeParse({ method: "cheque", amount: "10" }).success).toBe(false);
  });
});
