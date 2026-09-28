/**
 * Channel-provider interface for WhatsApp (ADR-0006, ADR-0013). A real vendor (e.g. a WhatsApp
 * Business Platform partner) is added from its official docs once chosen. Never guess a vendor API.
 */
export type WhatsAppMessage = { to: string; body: string; purpose: string };
export type WhatsAppSendResult =
  { ok: true; providerMessageId: string } | { ok: false; retryable: boolean; error: string };
export interface WhatsAppProvider {
  readonly id: string;
  send(message: WhatsAppMessage): Promise<WhatsAppSendResult>;
}
