import "server-only";
import type { z } from "zod";
import type { payment } from "@/schemas/api-v1";
import type { PaymentView } from "@/server/payments/service";

/** PaymentView → the public API shape. */
export function toApiPayment(p: PaymentView): z.infer<typeof payment> {
  return {
    id: p.id,
    appointment_id: p.appointmentId,
    method: p.method,
    amount: { amount_minor: p.amountMinor, currency: p.currency },
    paid_at: new Date(p.paidAt).toISOString(),
    refunded_at: p.refundedAt ? new Date(p.refundedAt).toISOString() : null,
  };
}
