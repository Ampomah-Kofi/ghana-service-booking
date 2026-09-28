import { z } from "zod";
import type { CountryCode } from "libphonenumber-js/max";
import { MOMO_NETWORKS, PAYMENT_METHOD_KEYS, type MomoNetwork } from "@/lib/payment-methods";
import { parseMoneyInput } from "@/lib/money";
import { phoneInputSchema } from "./auth";

/**
 * ADR-0017: no money moves through the app. These schemas are shared by the Server Actions and
 * /api/v1: the customer's choice, the business's accepted methods and its own payment details, and
 * payments the business records.
 */
export const paymentMethodSchema = z.enum(PAYMENT_METHOD_KEYS, { message: "Choose how you'll pay." });

export const acceptedMethodsSchema = z
  .array(z.enum(PAYMENT_METHOD_KEYS))
  .min(1, "Choose at least one way customers can pay.")
  .transform((v) => [...new Set(v)]);

const networkSchema = z.enum(Object.keys(MOMO_NETWORKS) as [MomoNetwork, ...MomoNetwork[]], {
  message: "Choose the network.",
});
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "") || v === undefined || v === null;

/** The owner's Mobile Money and/or bank details. Either side may be left empty, not both. */
export function paymentDetailsSchema(defaultCountry: CountryCode) {
  return z
    .object({
      momoNetwork: z.string().optional(),
      momoNumber: z.string().optional(),
      momoName: z.string().optional(),
      bankName: z.string().optional(),
      bankAccountName: z.string().optional(),
      bankAccountNumber: z.string().optional(),
    })
    .transform((v, ctx) => {
      const out: {
        momo: { network: MomoNetwork; phone: string; name: string } | null;
        bank: { bankName: string; accountName: string; accountNumber: string } | null;
      } = { momo: null, bank: null };
      if (!blank(v.momoNumber) || !blank(v.momoName)) {
        const network = networkSchema.safeParse(v.momoNetwork);
        const phone = phoneInputSchema(defaultCountry).safeParse(v.momoNumber ?? "");
        const name = (v.momoName ?? "").trim();
        if (!network.success) ctx.addIssue({ code: "custom", path: ["momoNetwork"], message: "Choose the network." });
        if (!phone.success)
          ctx.addIssue({ code: "custom", path: ["momoNumber"], message: "Enter a valid number, e.g. 024 123 4567." });
        if (name.length < 2 || name.length > 120)
          ctx.addIssue({ code: "custom", path: ["momoName"], message: "Enter the name on the wallet." });
        if (network.success && phone.success) out.momo = { network: network.data, phone: phone.data, name };
      }
      if (!blank(v.bankName) || !blank(v.bankAccountNumber) || !blank(v.bankAccountName)) {
        const bankName = (v.bankName ?? "").trim();
        const accountName = (v.bankAccountName ?? "").trim();
        const accountNumber = (v.bankAccountNumber ?? "").replace(/\s/g, "");
        if (bankName.length < 2 || bankName.length > 80)
          ctx.addIssue({ code: "custom", path: ["bankName"], message: "Enter the bank." });
        if (accountName.length < 2 || accountName.length > 120)
          ctx.addIssue({ code: "custom", path: ["bankAccountName"], message: "Enter the name on the account." });
        if (!/^\d{6,20}$/.test(accountNumber))
          ctx.addIssue({
            code: "custom",
            path: ["bankAccountNumber"],
            message: "Enter the account number (digits only).",
          });
        out.bank = { bankName, accountName, accountNumber };
      }
      return out;
    });
}

/** The business records money received. Amount typed in main units ("30" or "30.50"). */
export function recordPaymentSchema(minorUnit: number) {
  return z.object({
    method: z.enum(PAYMENT_METHOD_KEYS, { message: "Choose how they paid." }),
    amount: z
      .string()
      .trim()
      .transform((v, ctx) => {
        const minor = parseMoneyInput(v, minorUnit);
        if (minor === null || minor <= 0) {
          ctx.addIssue({ code: "custom", message: "Enter the amount received, e.g. 30 or 30.50." });
          return z.NEVER;
        }
        return minor;
      }),
    note: z
      .string()
      .trim()
      .max(200, "Use at most 200 characters.")
      .optional()
      .transform((v) => (v ? v : null)),
  });
}

export const refundSchema = z.object({
  note: z.string().trim().min(3, "Say why (the customer sees it).").max(200),
});
