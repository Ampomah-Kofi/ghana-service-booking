/** Why someone reports a review. Plain data (no Zod), so client components can import it cheaply. */
export const REPORT_REASONS = {
  spam: "Spam or advertising",
  offensive: "Rude or offensive",
  not_genuine: "Not a real visit",
  private_info: "Shares private information",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
