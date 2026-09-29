import "server-only";
import { randomUUID } from "node:crypto";
import type { SmsMessage, SmsProvider, SmsSendResult } from "./provider";

/**
 * MOCK. Not a production integration. Sends nothing: it prints the message to
 * the server log so developers can read OTP codes locally. Refused when
 * APP_ENV=production (see src/server/env.ts).
 */
export class MockSmsProvider implements SmsProvider {
  readonly id = "mock-sms";
  readonly sent: Array<SmsMessage & { providerMessageId: string }> = [];

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const providerMessageId = `mock_${randomUUID()}`;
    this.sent.push({ ...message, providerMessageId });
    console.info(`[MockSmsProvider] to=${message.to} purpose=${message.purpose} body=${JSON.stringify(message.body)}`);
    return { ok: true, providerMessageId };
  }
}
