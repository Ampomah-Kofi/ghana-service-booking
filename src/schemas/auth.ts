import { z } from "zod";
import type { CountryCode } from "libphonenumber-js/max";
import { parsePhone } from "@/lib/phone";

/** Phone input → E.164, validated with libphonenumber (not regex). */
export function phoneInputSchema(defaultCountry: CountryCode) {
  return z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .transform((value, ctx) => {
      const parsed = parsePhone(value, defaultCountry);
      if (!parsed.ok) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number, e.g. 024 123 4567." });
        return z.NEVER;
      }
      return parsed.e164;
    });
}

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code we sent you.");

export const e164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/, "Invalid phone number.");

export const emailSchema = z.email("Enter a valid email address.").max(320);

export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(128, "Use at most 128 characters.");

export const emailSignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const emailSignUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
