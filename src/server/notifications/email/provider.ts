/** Channel-provider interface for email (ADR-0006, ADR-0013). A real vendor is added from its docs once chosen. */
export type EmailMessage = { to: string; subject: string; text: string; purpose: string };
export type EmailSendResult =
  { ok: true; providerMessageId: string } | { ok: false; retryable: boolean; error: string };
export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
