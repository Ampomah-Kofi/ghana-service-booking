/**
 * Channel-provider interface for SMS (ADR-0006). Real vendors are added in
 * Phase 8 from their official docs. Never guess a vendor API (CLAUDE.md).
 */
export type SmsMessage = {
  /** E.164, e.g. "+233241234567" */
  to: string;
  body: string;
  /** Used for logs/metrics, e.g. "auth.otp" */
  purpose: string;
};

export type SmsSendResult = { ok: true; providerMessageId: string } | { ok: false; retryable: boolean; error: string };

export interface SmsProvider {
  readonly id: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}
