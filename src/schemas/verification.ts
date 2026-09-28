import { z } from "zod";

/** An admin's verification decision (ADR-0015). Shared by the admin form and the API. */
export const verificationDecisionSchema = z.object({
  status: z.enum(["verified", "declined", "none"], { message: "Choose verify, decline or remove." }),
  reason: z.string().trim().min(3, "Give a reason for the audit log.").max(500),
  // Shown to the owner (e.g. why it was declined). Optional.
  note: z
    .string()
    .trim()
    .max(300, "Keep the note to the owner under 300 characters.")
    .transform((v) => (v === "" ? null : v)),
});
export type VerificationDecision = z.infer<typeof verificationDecisionSchema>;
