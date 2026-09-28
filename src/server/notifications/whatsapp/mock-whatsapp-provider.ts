import "server-only";
import { randomUUID } from "node:crypto";
import type { WhatsAppMessage, WhatsAppProvider, WhatsAppSendResult } from "./provider";

/** MOCK. Not a production integration: logs the message and sends nothing. Refused when APP_ENV=production. */
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly id = "mock-whatsapp";
  readonly sent: Array<WhatsAppMessage & { providerMessageId: string }> = [];
  async send(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const providerMessageId = `mock_${randomUUID()}`;
    this.sent.push({ ...message, providerMessageId });
    console.info(
      `[MockWhatsAppProvider] to=${message.to} purpose=${message.purpose} body=${JSON.stringify(message.body)}`,
    );
    return { ok: true, providerMessageId };
  }
}
