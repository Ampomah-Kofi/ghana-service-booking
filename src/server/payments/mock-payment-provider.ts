import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  ChargeInput,
  ChargeNext,
  PaymentMethod,
  PaymentProvider,
  ProviderEvent,
  ProviderStatus,
  RefundResult,
} from "./provider";

/**
 * MOCK. Not a production integration: no money moves. It stands in for a Mobile Money / card
 * aggregator so the whole deposit flow can be built and tested (ADR-0005). The "remote" side is an
 * in-memory map; /dev/mock-pay/[reference] plays the customer's phone and posts a signed webhook.
 * Refused when APP_ENV=production (src/server/env.ts).
 */
type MockCharge = {
  reference: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  description: string;
  status: "pending" | "paid" | "failed";
  reason?: string;
};

const store: Map<string, MockCharge> = ((globalThis as { __mockPayments?: Map<string, MockCharge> }).__mockPayments ??=
  new Map());

export const MOCK_SIGNATURE_HEADER = "x-mock-signature";

export function signMockPayload(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";
  readonly methods = ["mobile_money", "card", "bank_transfer"] as const;

  constructor(
    private readonly secret: string,
    private readonly siteUrl: string,
  ) {}

  async createCharge(input: ChargeInput): Promise<{ next: ChargeNext }> {
    const reference = input.reference;
    store.set(reference, {
      reference,
      paymentId: input.paymentId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      method: input.method,
      description: input.description,
      status: "pending",
    });
    const devUrl = `${this.siteUrl.replace(/\/$/, "")}/dev/mock-pay/${encodeURIComponent(reference)}`;
    const next: ChargeNext =
      input.method === "mobile_money"
        ? {
            type: "await_customer_approval",
            message: "Approve the payment on your phone, then come back here.",
            devApproveUrl: devUrl,
          }
        : { type: "redirect", url: devUrl };
    return { next };
  }

  async verifyWebhook(req: { headers: Headers; rawBody: string }): Promise<ProviderEvent | null> {
    const given = req.headers.get(MOCK_SIGNATURE_HEADER) ?? "";
    const expected = signMockPayload(this.secret, req.rawBody);
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    let body: unknown;
    try {
      body = JSON.parse(req.rawBody);
    } catch {
      return null;
    }
    const e = body as Partial<{
      id: string;
      reference: string;
      outcome: ProviderEvent["outcome"];
      amount_minor: number;
      currency: string;
      reason: string;
    }>;
    if (!e.id || !e.reference || !e.outcome || typeof e.amount_minor !== "number" || !e.currency) return null;
    return {
      eventId: e.id,
      reference: e.reference,
      outcome: e.outcome,
      amountMinor: e.amount_minor,
      currency: e.currency,
      reason: e.reason,
      raw: body,
    };
  }

  async fetchStatus(providerReference: string): Promise<ProviderStatus> {
    const c = store.get(providerReference);
    if (!c || c.status === "pending") return { status: "pending" };
    return c.status === "paid"
      ? { status: "paid", amountMinor: c.amountMinor, currency: c.currency }
      : { status: "failed", reason: c.reason ?? "Declined" };
  }

  async refund(input: { providerReference: string; amountMinor: number }): Promise<RefundResult> {
    const c = store.get(input.providerReference);
    // An unknown reference (e.g. the dev server restarted) still "refunds": the mock holds no money.
    if (c && c.status !== "paid") return { ok: false, error: "Nothing was paid on this charge" };
    return { ok: true, reference: `mock_refund_${randomUUID()}` };
  }

  /** Dev only: what the mock "phone" shows. */
  charge(reference: string): MockCharge | undefined {
    return store.get(reference);
  }

  /** Dev only: the customer approves or declines on the mock "phone". Returns the signed webhook to send. */
  decide(reference: string, outcome: "paid" | "failed"): { rawBody: string; signature: string } | null {
    const c = store.get(reference);
    if (!c || c.status !== "pending") return null;
    c.status = outcome;
    if (outcome === "failed") c.reason = "Declined on the phone";
    const rawBody = JSON.stringify({
      id: `mock_evt_${randomUUID()}`,
      reference,
      outcome,
      amount_minor: c.amountMinor,
      currency: c.currency,
      reason: c.reason,
    });
    return { rawBody, signature: signMockPayload(this.secret, rawBody) };
  }
}
