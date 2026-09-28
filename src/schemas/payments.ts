import { z } from "zod";
import type { CountryCode } from "libphonenumber-js/max";
import { parseMoneyInput } from "@/lib/money";
import { phoneInputSchema } from "./auth";

/** Phase 9. Shared by the Pay screen (Server Action) and POST /api/v1/appointments/{id}/payments. */
export const MOMO_NETWORKS = { mtn: "MTN MoMo", telecel: "Telecel Cash", airteltigo: "AirtelTigo Money" } as const;
export type MomoNetworkKey = keyof typeof MOMO_NETWORKS;

export function startPaymentSchema(defaultCountry: CountryCode) {
  return z
    .discriminatedUnion("method", [
      z.object({
        method: z.literal("mobile_money"),
        network: z.enum(Object.keys(MOMO_NETWORKS) as [MomoNetworkKey, ...MomoNetworkKey[]], {
          message: "Choose your network.",
        }),
        phone: phoneInputSchema(defaultCountry),
      }),
      z.object({ method: z.literal("card") }),
      z.object({ method: z.literal("bank_transfer") }),
    ])
    .and(z.object({ kind: z.enum(["deposit", "full"]).default("deposit") }));
}

/** The business records money received at the visit. Amount typed in main units ("30" or "30.50"). */
export function manualPaymentSchema(minorUnit: number) {
  return z.object({
    method: z.enum(["cash", "mobile_money"], { message: "Choose cash or Mobile Money." }),
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
  reason: z.string().trim().min(3, "Say why (the customer sees it).").max(200),
});

/** Where the business gets paid. */
export function payoutAccountSchema(defaultCountry: CountryCode) {
  return z.discriminatedUnion("method", [
    z.object({
      method: z.literal("mobile_money"),
      accountName: z.string().trim().min(2, "Enter the name on the account.").max(120),
      network: z.enum(Object.keys(MOMO_NETWORKS) as [MomoNetworkKey, ...MomoNetworkKey[]], {
        message: "Choose the network.",
      }),
      phone: phoneInputSchema(defaultCountry),
    }),
    z.object({
      method: z.literal("bank"),
      accountName: z.string().trim().min(2, "Enter the name on the account.").max(120),
      bankName: z.string().trim().min(2, "Enter the bank.").max(80),
      accountNumber: z
        .string()
        .transform((v) => v.replace(/\s/g, ""))
        .pipe(z.string().regex(/^\d{6,20}$/, "Enter the account number (digits only).")),
    }),
  ]);
}
