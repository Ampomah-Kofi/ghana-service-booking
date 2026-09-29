import { z } from "zod";
import type { CountryCode } from "libphonenumber-js/max";
import { PAYMENT_METHOD_KEYS } from "@/lib/payment-methods";
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
    // How the customer will pay the business directly (information only; ADR-0017).
    paymentMethod: z.enum(PAYMENT_METHOD_KEYS, { message: "Choose how you'll pay." }).optional(),
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

// ── Provider actions (Phase 6) ──────────────────────────────────────────────

const appointmentStatus = z.enum(["pending", "confirmed", "arrived", "completed", "cancelled", "no_show"]);
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time.");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : null));

export const statusChangeSchema = z.object({
  appointmentId: z.uuid(),
  status: appointmentStatus,
  reason: optionalText(200),
  /** Typed by the provider in major units ("80" or "80.50"); converted with the currency's minor unit. */
  finalPrice: z.string().trim().max(20).optional(),
});

export function manualAppointmentSchema(defaultCountry: CountryCode) {
  return z
    .object({
      walkIn: z.enum(["0", "1"]).transform((v) => v === "1"),
      serviceId: z.uuid("Choose a service."),
      staffId: z.uuid("Choose who will do it."),
      date: localDateSchema.optional(),
      time: localTime.optional(),
      clientId: z.union([z.uuid(), z.literal("")]).optional(),
      clientName: optionalText(120),
      clientPhone: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value ? value : null))
        .pipe(phoneInputSchema(defaultCountry).nullable()),
      note: optionalText(500),
      allowOutsideHours: z
        .string()
        .nullish()
        .transform((v) => v === "on"),
    })
    .superRefine((v, ctx) => {
      if (!v.walkIn && !v.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Choose a date." });
      if (!v.walkIn && !v.time) ctx.addIssue({ code: "custom", path: ["time"], message: "Choose a time." });
      if (!v.walkIn && !v.clientId && !v.clientName)
        ctx.addIssue({ code: "custom", path: ["clientName"], message: "Enter the client's name or pick a client." });
    });
}

export const moveSchema = z.object({
  appointmentId: z.uuid(),
  staffId: z.uuid("Choose who will do it."),
  date: localDateSchema,
  time: localTime,
  allowOutsideHours: z
    .string()
    .nullish()
    .transform((v) => v === "on"),
});

export function clientSchema(defaultCountry: CountryCode) {
  return z.object({
    clientId: z.union([z.uuid(), z.literal("")]).transform((v) => (v ? v : null)),
    name: z.string().trim().min(1, "Enter the client's name.").max(120, "Use at most 120 characters."),
    phone: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null))
      .pipe(phoneInputSchema(defaultCountry).nullable()),
    notes: optionalText(2000),
  });
}
