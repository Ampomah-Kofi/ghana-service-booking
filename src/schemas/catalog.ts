import { z } from "zod";
import type { CountryCode } from "libphonenumber-js/max";
import { parseMoneyInput } from "@/lib/money";
import { validateWeek } from "@/lib/hours";
import { phoneInputSchema } from "@/schemas/auth";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

/** HTML checkboxes: "on" when ticked, absent (null/undefined) when not. */
const checkbox = z
  .string()
  .nullish()
  .transform((v) => v === "on" || v === "true");

function moneyField(minorUnit: number, { required }: { required: boolean }) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") {
        if (required) ctx.addIssue({ code: "custom", message: "Enter a price." });
        return null;
      }
      const minor = parseMoneyInput(value, minorUnit);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: "Enter an amount like 50 or 49.50." });
        return z.NEVER;
      }
      return minor;
    });
}

export function serviceSchema(minorUnit: number) {
  return (
    z
      .object({
        name: z.string().trim().min(1, "Enter a name.").max(120, "Use at most 120 characters."),
        description: optionalText(1000),
        price: moneyField(minorUnit, { required: false }),
        priceType: z.enum(["fixed", "from", "on_request"]),
        durationMinutes: z.coerce
          .number()
          .int()
          .min(5, "Choose a duration.")
          .max(720)
          .refine((v) => v % 5 === 0, "Use 5-minute steps."),
        isActive: checkbox,
        staffIds: z.array(z.uuid()).max(100),
      })
      .superRefine((v, ctx) => {
        if (v.priceType !== "on_request" && v.price === null)
          ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price, or choose “On request”." });
        if (v.price !== null && v.price > 100_000_000)
          ctx.addIssue({ code: "custom", path: ["price"], message: "That price is too high." });
      })
      // "On request" stores no amount (the database requires 0).
      .transform((v) => ({ ...v, price: v.priceType === "on_request" ? 0 : (v.price ?? 0) }))
  );
}

export const staffSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a name.").max(80, "Use at most 80 characters."),
  roleTitle: optionalText(60),
  bio: optionalText(1000),
  acceptsOnlineBookings: checkbox,
  serviceIds: z.array(z.uuid()).max(200),
});

export const weekHoursSchema = z
  .string()
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Those hours couldn't be read. Please try again." });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(
        z.object({
          weekday: z.number().int().min(1).max(7),
          opens: z.string().regex(/^\d{2}:\d{2}$/),
          closes: z.string().regex(/^(\d{2}:\d{2}|24:00)$/),
        }),
      )
      .max(28, "Too many time ranges."),
  )
  .superRefine((ranges, ctx) => {
    const problem = validateWeek(ranges);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const localTime = z.string().regex(/^\d{2}:\d{2}$/, "Choose a time.");

/** Time off, in the business's local time. All-day blocks run from the start date to the end of the end date. */
export const blockedTimeSchema = z
  .object({
    staffId: z
      .string()
      .transform((v) => (v === "" || v === "all" ? null : v))
      .pipe(z.uuid().nullable()),
    allDay: checkbox,
    startDate: localDate,
    startTime: z.string().optional(),
    endDate: localDate,
    endTime: z.string().optional(),
    reason: optionalText(200),
  })
  .superRefine((v, ctx) => {
    if (!v.allDay) {
      if (!localTime.safeParse(v.startTime).success)
        ctx.addIssue({ code: "custom", path: ["startTime"], message: "Choose a start time." });
      if (!localTime.safeParse(v.endTime).success)
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "Choose an end time." });
    }
  })
  .transform((v) => {
    const addDay = (date: string) => {
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    };
    return {
      staffId: v.staffId,
      reason: v.reason,
      startsLocal: v.allDay ? `${v.startDate}T00:00` : `${v.startDate}T${v.startTime}`,
      endsLocal: v.allDay ? `${addDay(v.endDate)}T00:00` : `${v.endDate}T${v.endTime}`,
    };
  })
  .superRefine((v, ctx) => {
    if (v.endsLocal <= v.startsLocal)
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "The end must be after the start." });
  });

export const bookingRulesSchema = z.object({
  slotIntervalMinutes: z.coerce
    .number()
    .int()
    .refine((v) => [5, 10, 15, 20, 30, 60].includes(v), "Choose an interval."),
  minNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  maxAdvanceDays: z.coerce.number().int().min(1, "At least 1 day.").max(365, "At most 365 days."),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(240),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(240),
  cancellationWindowHours: z.coerce.number().int().min(0).max(336),
  autoConfirm: checkbox,
});

export function inviteSchema(defaultCountry: CountryCode) {
  return z.object({ phone: phoneInputSchema(defaultCountry), role: z.enum(["staff", "manager"]) });
}

export const categoryAdminSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens."),
  description: z.string().trim().max(500),
  keywords: z
    .string()
    .transform((v) =>
      v
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(40)).max(40)),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  isActive: checkbox,
  reason: z.string().trim().min(3, "Say why, for the audit log.").max(500),
});
