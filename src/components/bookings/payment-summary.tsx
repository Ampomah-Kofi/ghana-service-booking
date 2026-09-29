import { CopyButton } from "@/components/ui/copy-button";
import { formatDateShort } from "@/lib/datetime";
import { MOMO_NETWORKS, PAYMENT_METHODS, paymentReference, type PaymentMethod } from "@/lib/payment-methods";
import { formatPhoneLocal } from "@/lib/phone";
import type { BookingPaymentDetails, PaymentView } from "@/server/payments/service";
import { ChoosePaymentForm } from "./choose-payment-form";

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS[method].label;
}

/**
 * The money side of a booking for its customer (ADR-0017): how they said they'll pay, the
 * business's own Mobile Money or bank details for that, and what the business has marked received.
 * Booker GH never takes the money.
 */
export function PaymentSummary({
  appointmentId,
  businessName,
  choice,
  accepted,
  details,
  payments,
  dueMinor,
  live,
  timezone,
  money,
}: {
  appointmentId: string;
  businessName: string;
  choice: PaymentMethod | null;
  accepted: PaymentMethod[];
  details: BookingPaymentDetails | null;
  payments: PaymentView[];
  /** The price to pay, when it's known (fixed, or the final price). */
  dueMinor: number | null;
  live: boolean;
  timezone: string;
  money: (minor: number) => string;
}) {
  const paid = payments.filter((p) => p.refundedAt === null).reduce((s, p) => s + p.amountMinor, 0);
  const left = dueMinor === null ? null : Math.max(0, dueMinor - paid);
  const method = choice ?? accepted[0] ?? "cash";
  const reference = paymentReference(appointmentId);
  const sendTo =
    method === "mobile_money" && details?.momo
      ? {
          title: `${details.momo.network ? MOMO_NETWORKS[details.momo.network as keyof typeof MOMO_NETWORKS] : "Mobile Money"}`,
          number: formatPhoneLocal(details.momo.number),
          raw: details.momo.number,
          name: details.momo.name,
        }
      : method === "bank_transfer" && details?.bank
        ? {
            title: details.bank.bankName ?? "Bank transfer",
            number: details.bank.accountNumber,
            raw: details.bank.accountNumber,
            name: details.bank.accountName,
          }
        : null;

  return (
    <section aria-labelledby="payment-heading" className="mb-6 overflow-hidden rounded-card bg-card lift">
      <div className="px-4 pt-3.5 pb-2">
        <h2 id="payment-heading" className="text-heading font-semibold">
          Payment
        </h2>
        <p className="text-small text-ink-muted">You pay {businessName} directly.</p>
      </div>

      <dl className="ios-list border-t border-border">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-small text-ink-muted">You&apos;ll pay with</dt>
          <dd className="text-body font-medium">{PAYMENT_METHODS[method].label}</dd>
        </div>
        {sendTo && live && left !== 0 ? (
          <div className="grid gap-1 px-4 py-3">
            <dt className="text-small text-ink-muted">
              Send {left !== null ? money(left) : "the amount"} by {sendTo.title} to
            </dt>
            <dd className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-body font-semibold tabular-nums select-all">{sendTo.number}</span>
                {sendTo.name ? <span className="block text-small text-ink-muted">{sendTo.name}</span> : null}
              </span>
              <CopyButton value={sendTo.raw} label="number" />
            </dd>
            <dd className="flex items-center justify-between gap-2">
              <span className="text-small">
                Reference <span className="font-semibold tabular-nums select-all">{reference}</span>
              </span>
              <CopyButton value={reference} label="reference" />
            </dd>
          </div>
        ) : live && (method === "mobile_money" || method === "bank_transfer") && left !== 0 ? (
          <p className="px-4 py-3 text-small text-ink-muted">
            {businessName} will tell you where to send it. Use reference{" "}
            <span className="font-semibold text-ink">{reference}</span>.
          </p>
        ) : null}
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="min-w-0">
              <span className="block text-body">{PAYMENT_METHODS[p.method].label}</span>
              <span className={`block text-small ${p.refundedAt ? "text-info" : "text-success"}`}>
                {p.refundedAt
                  ? `Refunded${p.refundNote ? ` · ${p.refundNote}` : ""}`
                  : `Received ${formatDateShort(p.paidAt, timezone)}`}
              </span>
            </dt>
            <dd className={`text-body font-semibold tabular-nums ${p.refundedAt ? "text-ink-muted line-through" : ""}`}>
              {money(p.amountMinor)}
            </dd>
          </div>
        ))}
      </dl>

      {paid > 0 || left === 0 ? (
        <p className="border-t border-border px-4 py-3 text-small text-ink-muted">
          {left === 0
            ? "Paid in full, as recorded by the business."
            : left !== null
              ? `${money(paid)} paid · ${money(left)} left, as recorded by the business.`
              : `${money(paid)} paid, as recorded by the business.`}
        </p>
      ) : null}

      {live && accepted.length > 1 && paid === 0 ? (
        <ChoosePaymentForm appointmentId={appointmentId} accepted={accepted} current={method} />
      ) : null}
    </section>
  );
}
