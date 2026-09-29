import "server-only";
import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./provider";

/** MOCK. Not a production integration: logs the email and sends nothing. Refused when APP_ENV=production. */
export class MockEmailProvider implements EmailProvider {
  readonly id = "mock-email";
  readonly sent: Array<EmailMessage & { providerMessageId: string }> = [];
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const providerMessageId = `mock_${randomUUID()}`;
    this.sent.push({ ...message, providerMessageId });
    console.info(
      `[MockEmailProvider] to=${message.to} purpose=${message.purpose} subject=${JSON.stringify(message.subject)}`,
    );
    return { ok: true, providerMessageId };
  }
}
