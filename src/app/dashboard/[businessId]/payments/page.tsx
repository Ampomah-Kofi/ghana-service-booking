import type { Metadata } from "next";
import Link from "next/link";
import { paymentMethodLabel } from "@/components/bookings/payment-summary";
import { PaymentRulesForm } from "@/components/payments/payment-rules-form";
import { PayoutForm } from "@/components/payments/payout-form";
import { GroupedSection } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightIcon, WalletIcon } from "@/components/ui/icons";
import { LargeTitle } from "@/components/ui/large-title";
import { formatDateShort, formatTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { MOMO_NETWORKS } from "@/schemas/payments";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { getBookingRules } from "@/server/businesses/schedule";
import { getPaymentProvider } from "@/server/payments";
import { listBusinessPayments, type BusinessPaymentRow } from "@/server/payments/service";
import { getPayoutAccount } from "@/server/payments/settings";

export const metadata: Metadata = { title: "Payments" };

const STATUS: Record<BusinessPaymentRow["status"], string> = {
  pending: "Waiting",
  paid: "Paid",
  failed: "Didn't go through",
  expired: "Timed out",
  refund_pending: "Refund on its way",
  refunded: "Refunded",
};

/**
 * Money for owners and managers (Phase 9): what came in over the last 7 days, the online payment
 * switches and, for the owner, where online payments are paid out. Staff never see amounts (RLS).
 */
export default async function PaymentsPage({ params }: PageProps<"/dashboard/[businessId]/payments">) {
  const { businessId } = await params;
  const { db, business, role } = await managedBusinessOr404(businessId);
  const since = new Date(new Date().getTime() - 7 * 86_400_000);
  const isOwner = role === "owner";
  const [payments, rules, payout] = await Promise.all([
    listBusinessPayments(db, business.id, since),
    getBookingRules(db, business.id),
    isOwner ? getPayoutAccount(db, business.id) : Promise.resolve(null),
  ]);
  const provider = getPaymentProvider();
  const tz = business.timezone;
  const money = (minor: number) =>
    formatMoney({ amountMinor: minor, currency: business.currency.code }, business.currency);

  const settled = payments.filter((p) => p.status === "paid" || p.status === "refund_pending");
  const online = settled.filter((p) => p.provider !== "cash" && p.provider !== "manual");
  const atVisit = settled.filter((p) => p.provider === "cash" || p.provider === "manual");
  const refunded = payments.filter((p) => p.status === "refunded");
  const sum = (list: BusinessPaymentRow[]) => list.reduce((s, p) => s + p.amountMinor, 0);
  const shown = payments.filter((p) => p.status !== "failed" && p.status !== "expired");
  const onlineOn = rules.collect_deposits_online || rules.allow_full_payment_online;

  return (
    <>
      <LargeTitle title="Payments" className="mb-1" />
      <p className="mb-5 text-body text-ink-muted">
        Customers pay you at the visit (cash or Mobile Money), or online if you switch it on below.
      </p>

      <section aria-labelledby="week-heading" className="mb-8">
        <h2 id="week-heading" className="mb-1.5 px-4 text-small font-medium text-ink-muted">
          Last 7 days
        </h2>
        <dl className="grid grid-cols-3 gap-2">
          {[
            ["Online", sum(online)],
            ["At the visit", sum(atVisit)],
            ["Refunded", sum(refunded)],
          ].map(([label, amount]) => (
            <div key={label} className="rounded-card bg-card px-3 py-3 lift">
              <dt className="text-small text-ink-muted">{label}</dt>
              <dd className="text-heading font-bold tabular-nums">{money(Number(amount))}</dd>
            </div>
          ))}
        </dl>
      </section>

      {shown.length === 0 ? (
        <div className="mb-8">
          <EmptyState
            icon={WalletIcon}
            title="No payments this week"
            body="Deposits paid online and cash you record on an appointment show up here."
          />
        </div>
      ) : (
        <GroupedSection title="Payments">
          {shown.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/${business.id}/appointments/${p.appointmentId}`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-fill"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body">
                  {p.customerName} · {p.serviceName}
                </span>
                <span className="block truncate text-small text-ink-muted">
                  {paymentMethodLabel(p)} · {STATUS[p.status]} · {formatDateShort(p.paidAt ?? p.createdAt, tz)},{" "}
                  {formatTime(p.paidAt ?? p.createdAt, tz)}
                </span>
              </span>
              <span
                className={`shrink-0 text-body font-semibold tabular-nums ${p.status === "refunded" ? "text-ink-muted line-through" : ""}`}
              >
                {money(p.amountMinor)}
              </span>
              <ChevronRightIcon className="shrink-0 text-ink-muted" />
            </Link>
          ))}
        </GroupedSection>
      )}

      <h2 className="mb-1.5 px-4 text-small font-medium text-ink-muted">Online payments</h2>
      <PaymentRulesForm
        businessId={business.id}
        canTurnOn={isOwner ? payout !== null : true}
        values={{
          collectDepositsOnline: rules.collect_deposits_online,
          allowFullPaymentOnline: rules.allow_full_payment_online,
          refundDepositOnNoShow: rules.refund_deposit_on_no_show,
        }}
      />
      <p className="mt-2 mb-8 px-4 text-small text-ink-muted">
        {provider === null
          ? "Online payments aren't available yet. Customers just book and pay at the visit."
          : provider.id === "mock"
            ? "Test mode: online payments are simulated and no real money moves."
            : "Customers pay with Mobile Money, card or bank transfer. The money goes to the account below."}{" "}
        {!onlineOn && isOwner && payout === null ? "Add where you get paid first." : null}
      </p>

      <GroupedSection
        title="Where you get paid"
        footer={
          isOwner
            ? "Only you can see or change this. After a change, online payments go to the new account once it's checked."
            : undefined
        }
      >
        {!isOwner ? (
          <p className="px-4 py-3 text-body text-ink-muted">Only the owner can see or change where the money goes.</p>
        ) : payout ? (
          <>
            <div className="flex min-h-14 items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-body">
                  {payout.method === "mobile_money"
                    ? `${payout.network ? MOMO_NETWORKS[payout.network] : "Mobile Money"} · ending ${payout.last4}`
                    : `${payout.bankName ?? "Bank"} · ending ${payout.last4}`}
                </span>
                <span className="block truncate text-small text-ink-muted">{payout.accountName}</span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-small font-medium ${
                  payout.status === "verified" ? "bg-success/10 text-success" : "bg-fill text-ink-muted"
                }`}
              >
                {payout.status === "verified" ? "Checked" : "Saved"}
              </span>
            </div>
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 py-3 text-body font-medium text-primary">
                Change payout details
              </summary>
              <PayoutForm businessId={business.id} defaultName={payout.accountName} />
            </details>
          </>
        ) : (
          <PayoutForm businessId={business.id} defaultName={business.name} />
        )}
      </GroupedSection>
    </>
  );
}
