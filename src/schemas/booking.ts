import { z } from "zod";
import type { CountryCode } from "libphonenumber-js/max";
import { phoneInputSchema } from "./auth";

/** Shared by the booking form (Server Action) and POST /api/v1/appointments. */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-01.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Use a real date.");

/** A chosen staff member, or "any" for "any available professional". */
export const staffChoiceSchema = z.union([z.uuid(), z.literal("any")]);

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency key must be 8-100 characters.")
  .max(100, "Idempotency key must be 8-100 characters.")
  .regex(/^[A-Za-z0-9._:-]+$/, "Idempotency key may use letters, digits and . _ : - only.");

export function bookingSchema(defaultCountry: CountryCode) {
  return z.object({
    serviceId: z.uuid("Choose a service."),
    staff: staffChoiceSchema,
    startsAt: z.iso.datetime({ offset: true, message: "Choose a time." }),
    customerName: z.string().trim().min(1, "Enter your name.").max(120, "Use at most 120 characters."),
    // Empty = the phone number on the customer's account.
    customerPhone: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null))
      .pipe(phoneInputSchema(defaultCountry).nullable()),
    note: z
      .string()
      .trim()
      .max(500, "Use at most 500 characters.")
      .optional()
      .transform((value) => (value ? value : null)),
    idempotencyKey: idempotencyKeySchema,
  });
}

export type BookingInput = z.infer<ReturnType<typeof bookingSchema>>;

export const rescheduleSchema = z.object({
  appointmentId: z.uuid(),
  staff: staffChoiceSchema,
  startsAt: z.iso.datetime({ offset: true, message: "Choose a time." }),
});

export const cancelSchema = z.object({
  appointmentId: z.uuid(),
  reason: z
    .string()
    .trim()
    .max(200, "Use at most 200 characters.")
    .optional()
    .transform((value) => (value ? value : null)),
});
