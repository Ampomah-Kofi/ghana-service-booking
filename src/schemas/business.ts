import { z } from "zod";
import type { CountryCode } from "libphonenumber-js/max";
import { phoneInputSchema } from "@/schemas/auth";

/** Shared by onboarding forms and Server Actions (CLAUDE.md: one schema, both sides). */

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

export const businessKindSchema = z.enum(["solo", "team"], { message: "Choose who works at the business." });

export const businessNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(120, "Use at most 120 characters.");

export const createBusinessSchema = z.object({
  kind: businessKindSchema,
  name: businessNameSchema,
  categoryId: z.uuid("Choose a category."),
});

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters.")
  .max(60, "Use at most 60 characters.")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens only.");

export const aboutSchema = z.object({
  kind: businessKindSchema,
  name: businessNameSchema,
  categoryId: z.uuid("Choose a category."),
  description: optionalText(2000, "Use at most 2000 characters."),
});

export const locationSchema = z
  .object({
    // "" = nothing chosen yet, "other" = town not in our list (then localityText is required).
    cityChoice: z.string().trim(),
    localityText: optionalText(80, "Use at most 80 characters."),
    areaId: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid().nullable()),
    addressLine: optionalText(200, "Use at most 200 characters."),
    landmark: optionalText(200, "Use at most 200 characters."),
    directions: optionalText(500, "Use at most 500 characters."),
    lat: z.coerce.number().min(-90).max(90).nullable().catch(null),
    lng: z.coerce.number().min(-180).max(180).nullable().catch(null),
  })
  .superRefine((v, ctx) => {
    if (v.cityChoice === "") {
      ctx.addIssue({ code: "custom", path: ["cityId"], message: "Choose a town or city." });
    } else if (v.cityChoice === "other") {
      if (!v.localityText || v.localityText.length < 2) {
        ctx.addIssue({ code: "custom", path: ["localityText"], message: "Enter your town's name." });
      }
    } else if (!z.uuid().safeParse(v.cityChoice).success) {
      ctx.addIssue({ code: "custom", path: ["cityId"], message: "Choose a town or city." });
    }
  })
  .transform(({ cityChoice, ...rest }) => {
    const cityId = cityChoice === "other" ? null : cityChoice;
    return {
      ...rest,
      cityId,
      areaId: cityId ? rest.areaId : null,
      localityText: cityId ? null : rest.localityText,
      // Both coordinates or neither.
      lat: rest.lat !== null && rest.lng !== null ? rest.lat : null,
      lng: rest.lat !== null && rest.lng !== null ? rest.lng : null,
    };
  });

/** Contact step. Phones go through libphonenumber (via phoneInputSchema), never regex alone. */
export function contactSchema(defaultCountry: CountryCode) {
  const optionalPhone = z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(phoneInputSchema(defaultCountry).nullable());
  return z
    .object({
      phone: optionalPhone,
      whatsappSameAsPhone: z
        .string()
        .optional()
        .transform((v) => v === "on"),
      whatsapp: optionalPhone,
      email: z
        .string()
        .trim()
        .transform((v) => (v === "" ? null : v))
        .pipe(z.email("Enter a valid email address.").max(320).nullable()),
    })
    .transform((v) => ({ phone: v.phone, whatsapp: v.whatsappSameAsPhone ? v.phone : v.whatsapp, email: v.email }))
    .superRefine((v, ctx) => {
      if (!v.phone && !v.whatsapp) {
        ctx.addIssue({
          code: "custom",
          path: ["phone"],
          message: "Add a phone or WhatsApp number so customers can reach you.",
        });
      }
    });
}
