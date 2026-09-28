import "server-only";

/**
 * Provider-agnostic payments (ADR-0005, docs/architecture.md §8). Money goes from the customer to
 * the business through the provider; this app only records attempts and applies provider events.
 */
export type PaymentMethod = "mobile_money" | "card" | "bank_transfer";
export type MomoNetwork = "mtn" | "telecel" | "airteltigo";

export type ChargeInput = {
  paymentId: string;
  /**
   * Our unique key for this attempt. Adapters send it as the provider's merchant reference and it
   * comes back on webhooks, so the request path never needs the secret key (ADR-0017).
   */
  reference: string;
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  customer: { name: string; phoneE164?: string; network?: MomoNetwork };
  description: string;
  /** Where the customer comes back to after a redirect (card). */
  returnUrl: string;
};

export type ChargeNext =
  | { type: "redirect"; url: string }
  /** e.g. a Mobile Money prompt on the customer's phone */
  | { type: "await_customer_approval"; message: string; devApproveUrl?: string }
  | { type: "none" };

export type ProviderEvent = {
  eventId: string;
  reference: string;
  outcome: "paid" | "failed" | "refunded";
  amountMinor: number;
  currency: string;
  reason?: string;
  raw: unknown;
};

export type ProviderStatus =
  | { status: "pending" }
  | { status: "paid"; amountMinor: number; currency: string }
  | { status: "failed"; reason: string };

export type RefundResult = { ok: true; reference: string } | { ok: false; error: string };

export interface PaymentProvider {
  readonly id: string;
  readonly methods: readonly PaymentMethod[];
  createCharge(input: ChargeInput): Promise<{ next: ChargeNext }>;
  /** Returns null when the signature is wrong (never throw on a bad request). */
  verifyWebhook(req: { headers: Headers; rawBody: string }): Promise<ProviderEvent | null>;
  fetchStatus(providerReference: string): Promise<ProviderStatus>;
  refund(input: {
    providerReference: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<RefundResult>;
}
