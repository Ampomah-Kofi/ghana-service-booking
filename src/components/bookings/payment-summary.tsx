import Link from "next/link";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { MOMO_NETWORKS } from "@/schemas/payments";
import type { PaymentView } from "@/server/payments/service";

const KIND = { deposit: "Deposit", full: "Payment", balance: "Balance" } as const;
const STATUS: Record<PaymentView["status"], { label: string; tone: string }> = {
  pending: { label: "Waiting", tone: "text-warning" },
  paid: { label: "Paid", tone: "text-success" },
  failed: { label: "Didn't go through", tone: "text-ink-muted" },
  expired: { label: "Timed out", tone: "text-ink-muted" },
  refund_pending: { label: "Refund on its way", tone: "text-info" },
  refunded: { label: "Refunded", tone: "text-info" },
};

export function paymentMethodLabel(p: Pick<PaymentView, "method" | "network" | "provider">): string {
  if (p.method === "cash") return "Cash";
  if (p.method === "mobile_money") return p.network ? MOMO_NETWORKS[p.network] : "Mobile Money";
  if (p.method === "bank_transfer") return "Bank transfer";
  return "Card";
}

/**
 * The money side of a booking (Phase 9): what's paid, what's left for the visit, and a Pay button
 * while a deposit holds the slot. Failed and timed-out attempts are left out once something is paid.
 */
export function PaymentSummary({
  appointmentId,
  payments,
  priceMinor,
  depositMinor,
  holdExpiresAt,
  canPayRest,
  live,
  money,
}: {
  appointmentId: string;
  payments: PaymentView[];
  priceMinor: number;
  depositMinor: number | null;
  holdExpiresAt: string | null;
  canPayRest: boolean;
  live: boolean;
  money: (minor: number) => string;
}) {
  const paid = payments
    .filter((p) => p.status === "paid" || p.status === "refund_pending")
    .reduce((s, p) => s + p.amountMinor, 0);
  const visible =
    paid > 0 ? payments.filter((p) => p.status !== "failed" && p.status !== "expired") : payments.slice(-1);
  const left = Math.max(0, priceMinor - paid);
  if (payments.length === 0 && !holdExpiresAt && !(canPayRest && live && left > 0)) {
    return depositMinor && live ? (
      <p className="mb-6 rounded-card bg-card px-4 py-3 text-small text-ink-muted lift">
        Deposit {money(depositMinor)}: the business will tell you how to pay it.
      </p>
    ) : null;
  }
  return (
    <section aria-labelledby="payment-heading" className="mb-6 overflow-hidden rounded-card bg-card lift">
      <h2 id="payment-heading" className="px-4 pt-4 text-heading font-semibold">
        Payment
      </h2>
      {holdExpiresAt && live ? (
        <div className="grid gap-3 p-4">
          <p className="text-body">
            Pay the {money(depositMinor ?? 0)} deposit to keep this time.{" "}
            <span className="font-semibold text-accent-ink">
              <HoldCountdown until={holdExpiresAt} />
            </span>
          </p>
          <Link
            href={`/bookings/${appointmentId}/pay`}
            className="pressable flex min-h-12 items-center justify-center rounded-full bg-primary font-semibold text-on-primary"
          >
            Pay deposit {money(depositMinor ?? 0)}
          </Link>
        </div>
      ) : null}
      {visible.length > 0 ? (
        <ul className="ios-list">
          {visible.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-body">
                  {KIND[p.kind]} · {paymentMethodLabel(p)}
                </span>
                <span className={`block text-small ${STATUS[p.status].tone}`}>
                  {STATUS[p.status].label}
                  {p.status === "failed" && p.failureReason ? `: ${p.failureReason}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-body font-semibold tabular-nums">{money(p.amountMinor)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {paid > 0 ? (
        <p className="border-t border-border px-4 py-3 text-small text-ink-muted">
          Paid {money(paid)}
          {left > 0 && live ? ` · ${money(left)} at the visit` : ""}
        </p>
      ) : null}
      {canPayRest && live && !holdExpiresAt && left > 0 ? (
        <div className="px-4 pb-4">
          <Link
            href={`/bookings/${appointmentId}/pay?kind=full`}
            className="pressable flex min-h-11 items-center justify-center rounded-full bg-fill text-small font-semibold text-primary"
          >
            Pay {money(left)} now (optional)
          </Link>
        </div>
      ) : null}
    </section>
  );
}
