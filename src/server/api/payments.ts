import "server-only";
import type { z } from "zod";
import type { payment } from "@/schemas/api-v1";
import type { PaymentView } from "@/server/payments/service";

const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);

/** PaymentView → the public API shape. */
export function toApiPayment(p: PaymentView): z.infer<typeof payment> {
  return {
    id: p.id,
    appointment_id: p.appointmentId,
    kind: p.kind,
    method: p.method,
    network: p.network,
    status: p.status,
    amount: { amount_minor: p.amountMinor, currency: p.currency },
    reference: p.reference,
    failure_reason: p.failureReason,
    paid_at: iso(p.paidAt),
    refunded_at: iso(p.refundedAt),
    created_at: new Date(p.createdAt).toISOString(),
  };
}
