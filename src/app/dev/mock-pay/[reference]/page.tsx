import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { serverEnv } from "@/server/env";
import { getPaymentProvider } from "@/server/payments";
import { MockPaymentProvider } from "@/server/payments/mock-payment-provider";
import { decideMockPaymentAction } from "./actions";

export const metadata: Metadata = { title: "Mock payment (dev only)", robots: { index: false } };

/**
 * MOCK ONLY: stands in for the Mobile Money prompt or the card page of a real provider, so the
 * deposit flow can be tested end to end. 404 unless PAYMENTS_PROVIDER=mock outside production.
 */
export default async function MockPayPage({ params }: PageProps<"/dev/mock-pay/[reference]">) {
  const provider = getPaymentProvider();
  if (serverEnv().APP_ENV === "production" || !(provider instanceof MockPaymentProvider)) notFound();
  const reference = decodeURIComponent((await params).reference);
  const charge = provider.charge(reference);
  if (!charge) notFound();
  const amount = formatMoney(
    { amountMinor: charge.amountMinor, currency: charge.currency },
    { code: charge.currency, symbol: charge.currency === "GHS" ? "GH₵" : charge.currency, minorUnit: 2 },
  );
  return (
    <div className="mx-auto max-w-sm pt-6">
      <p className="mb-4 rounded-control bg-warning/12 px-3 py-2 text-small font-semibold text-warning">
        MOCK PAYMENT · development only · no money moves
      </p>
      <div className="rounded-card bg-card p-5 text-center lift">
        <p className="text-small text-ink-muted">
          {charge.method === "mobile_money"
            ? "Mobile Money prompt"
            : charge.method === "bank_transfer"
              ? "Bank transfer page"
              : "Card payment page"}
        </p>
        <p className="mt-1 text-display font-bold tabular-nums">{amount}</p>
        <p className="mt-1 text-body text-ink-muted">{charge.description}</p>
        {charge.status === "pending" ? (
          <form action={decideMockPaymentAction} className="mt-6 grid grid-cols-2 gap-2">
            <input type="hidden" name="reference" value={reference} />
            <button
              name="outcome"
              value="failed"
              className="pressable min-h-12 rounded-full bg-fill font-semibold text-ink"
              type="submit"
            >
              Decline
            </button>
            <button
              name="outcome"
              value="paid"
              className="pressable min-h-12 rounded-full bg-primary font-semibold text-on-primary"
              type="submit"
            >
              Approve
            </button>
          </form>
        ) : (
          <p className="mt-6 text-body font-medium">Already {charge.status}.</p>
        )}
      </div>
    </div>
  );
}
