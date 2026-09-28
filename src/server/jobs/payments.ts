import "server-only";
import { createAdminClient } from "@/server/privileged/supabase-admin";
import type { Json } from "@/server/db/types";
import { getPaymentProvider, paymentProviderById } from "@/server/payments";
import type { ProviderEvent } from "@/server/payments/provider";

export type ApplyResult = "applied" | "duplicate" | "unknown_payment" | "ignored" | "mismatch";

/** Apply one provider event exactly once (the database dedupes on the provider's event id). */
export async function applyProviderEvent(providerId: string, event: ProviderEvent): Promise<ApplyResult> {
  const { data, error } = await createAdminClient().rpc("apply_payment_event", {
    p_provider: providerId,
    p_event_id: event.eventId,
    p_reference: event.reference,
    p_outcome: event.outcome,
    p_amount_minor: event.amountMinor,
    p_currency: event.currency,
    p_payload: { reason: event.reason ?? null, raw: (event.raw ?? null) as Json },
  });
  if (error) throw new Error(`apply_payment_event failed: ${error.message}`);
  return data as ApplyResult;
}

/** A provider webhook: verify the signature, then apply. Returns the HTTP answer. */
export async function handlePaymentWebhook(
  providerId: string,
  headers: Headers,
  rawBody: string,
): Promise<{ status: number; body: Record<string, string> }> {
  const provider = paymentProviderById(providerId);
  if (!provider) return { status: 404, body: { error: "unknown provider" } };
  const event = await provider.verifyWebhook({ headers, rawBody });
  if (!event) return { status: 401, body: { error: "bad signature" } };
  const result = await applyProviderEvent(provider.id, event);
  // 200 for every recorded outcome (duplicates included), so the provider stops retrying.
  return { status: 200, body: { result } };
}

export type PaymentJobResult = { holdsReleased: number; reconciled: number; refunded: number; refundsFailed: number };

/**
 * The payments job (ADR-0005), every minute next to the notification dispatcher:
 *  1. release expired deposit holds (frees the slots);
 *  2. ask the provider about attempts still pending after 10 minutes (webhooks get lost);
 *  3. send queued refunds (claimed with SKIP LOCKED, so parallel runs never refund twice).
 */
export async function runPaymentJobs(): Promise<PaymentJobResult> {
  const db = createAdminClient();
  const result: PaymentJobResult = { holdsReleased: 0, reconciled: 0, refunded: 0, refundsFailed: 0 };

  const { data: released, error: holdError } = await db.rpc("expire_payment_holds");
  if (holdError) throw new Error(`expire_payment_holds failed: ${holdError.message}`);
  result.holdsReleased = released;

  const provider = getPaymentProvider();
  if (!provider) return result;

  const { data: stale, error: staleError } = await db.rpc("stale_pending_payments", {
    p_older_than_minutes: 10,
    p_limit: 50,
  });
  if (staleError) throw new Error(`stale_pending_payments failed: ${staleError.message}`);
  for (const p of stale) {
    if (p.provider !== provider.id || !p.provider_reference) continue;
    const s = await provider.fetchStatus(p.provider_reference);
    if (s.status === "pending") continue;
    const r = await applyProviderEvent(provider.id, {
      eventId: `reconcile:${p.provider_reference}:${s.status}`,
      reference: p.provider_reference,
      outcome: s.status,
      amountMinor: s.status === "paid" ? s.amountMinor : 0,
      currency: s.status === "paid" ? s.currency : "",
      reason: s.status === "failed" ? s.reason : undefined,
      raw: { source: "reconciliation" },
    });
    if (r === "applied") result.reconciled += 1;
  }

  const { data: refunds, error: refundError } = await db.rpc("claim_refunds", { p_limit: 20 });
  if (refundError) throw new Error(`claim_refunds failed: ${refundError.message}`);
  for (const r of refunds) {
    if (r.provider !== provider.id || !r.provider_reference) {
      await db.rpc("finish_refund", {
        p_payment_id: r.payment_id,
        p_ok: false,
        p_error: `No refund route for provider ${r.provider}`,
      });
      result.refundsFailed += 1;
      continue;
    }
    const res = await provider.refund({
      providerReference: r.provider_reference,
      amountMinor: r.amount_minor,
      currency: r.currency_code,
      idempotencyKey: r.idempotency_key,
    });
    await db.rpc("finish_refund", {
      p_payment_id: r.payment_id,
      p_ok: res.ok,
      p_reference: res.ok ? res.reference : undefined,
      p_error: res.ok ? undefined : res.error,
    });
    if (res.ok) result.refunded += 1;
    else result.refundsFailed += 1;
  }
  return result;
}
