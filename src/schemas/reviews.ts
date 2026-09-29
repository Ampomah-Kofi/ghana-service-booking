import { z } from "zod";
import { REPORT_REASONS, type ReportReason } from "@/lib/review-reasons";

/** Shared by Server Actions, forms and /api/v1 (docs/api/v1.md). */
export const reviewInputSchema = z.object({
  rating: z.coerce
    .number({ message: "Choose 1 to 5 stars." })
    .int("Choose 1 to 5 stars.")
    .min(1, "Choose 1 to 5 stars.")
    .max(5, "Choose 1 to 5 stars."),
  body: z
    .string()
    .trim()
    .max(1000, "Keep your review under 1000 characters.")
    .optional()
    .transform((v) => v || null),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const replyInputSchema = z.object({
  body: z.string().trim().min(1, "Write a reply.").max(1000, "Keep your reply under 1000 characters."),
});

export { REPORT_REASONS, type ReportReason };

export const reportInputSchema = z.object({
  reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]], { message: "Choose a reason." }),
  details: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters.")
    .optional()
    .transform((v) => v || null),
});

export const moderationInputSchema = z.object({
  status: z.enum(["published", "hidden", "removed"]),
  reason: z.string().trim().min(3, "Give a reason for the audit log.").max(500),
});

export const profileNameSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(120, "Keep your name under 120 characters."),
});

export const messagePreferencesSchema = z.object({
  text: z.enum(["sms", "whatsapp", "none"]),
  email: z.union([z.literal("on"), z.boolean(), z.undefined(), z.null()]).transform((v) => v === "on" || v === true),
});
