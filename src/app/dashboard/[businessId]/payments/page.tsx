import type { Metadata } from "next";
import Link from "next/link";
import { AcceptedMethodsForm } from "@/components/payments/accepted-methods-form";
import { PaymentDetailsForm } from "@/components/payments/payment-details-form";
import { GroupedSection } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightIcon, WalletIcon } from "@/components/ui/icons";
import { LargeTitle } from "@/components/ui/large-title";
import { BRAND } from "@/lib/brand";
import { formatDateShort } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { formatPhoneLocal } from "@/lib/phone";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { getBookingRules } from "@/server/businesses/schedule";
import { listBusinessPayments, type BusinessPaymentRow } from "@/server/payments/service";
import { getPaymentDetails } from "@/server/payments/settings";

export const metadata: Metadata = { title: "Payments" };

/**
 * Money for owners and managers (ADR-0017). Customers pay the business directly; this page is
 * where the business says how it takes payment, shares its own MoMo / bank details with booked
 * customers, and sees what it has marked paid. Staff never see amounts (RLS).
 */
export default async function PaymentsPage({ params }: PageProps<"/dashboard/[businessId]/payments">) {
  const { businessId } = await params;
  const { db, business, role } = await managedBusinessOr404(businessId);
  const since = new Date(new Date().getTime() - 7 * 86_400_000);
  const [payments, rules, details] = await Promise.all([
    listBusinessPayments(db, business.id, since),
    getBookingRules(db, business.id),
    getPaymentDetails(db, business.id),
  ]);
  const tz = business.timezone;
  const money = (minor: number) =>
    formatMoney({ amountMinor: minor, currency: business.currency.code }, business.currency);
  const sum = (list: BusinessPaymentRow[]) => list.reduce((s, p) => s + p.amountMinor, 0);
  const kept = payments.filter((p) => p.refundedAt === null);
  const tiles: [string, number][] = [
    ["Received", sum(kept)],
    ["Cash", sum(kept.filter((p) => p.method === "cash"))],
    ["Refunded", sum(payments.filter((p) => p.refundedAt !== null))],
  ];

  return (
    <>
      <LargeTitle title="Payments" className="mb-1" />
      <p className="mb-5 text-body text-ink-muted">
        Customers pay you directly. {BRAND.name} never takes payment. Mark bookings paid when you have the money.
      </p>

      <section aria-labelledby="week-heading" className="mb-8">
        <h2 id="week-heading" className="mb-1.5 px-4 text-small font-medium text-ink-muted">
          Last 7 days, as you recorded them
        </h2>
        <dl className="grid grid-cols-3 gap-2">
          {tiles.map(([label, amount]) => (
            <div key={label} className="min-w-0 rounded-card bg-card px-3 py-3 lift">
              <dt className="text-small text-ink-muted">{label}</dt>
              <dd className="truncate text-heading font-bold tabular-nums">{money(amount)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {payments.length === 0 ? (
        <div className="mb-8">
          <EmptyState
            icon={WalletIcon}
            title="Nothing marked paid this week"
            body="Open an appointment and tap Mark paid when a customer pays you."
          />
        </div>
      ) : (
        <GroupedSection title="Marked paid">
          {payments.map((p) => (
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
                  {PAYMENT_METHODS[p.method].label} · {formatDateShort(p.paidAt, tz)}
                  {p.refundedAt ? " · Refunded" : ""}
                </span>
              </span>
              <span
                className={`shrink-0 text-body font-semibold tabular-nums ${p.refundedAt ? "text-ink-muted line-through" : ""}`}
              >
                {money(p.amountMinor)}
              </span>
              <ChevronRightIcon className="shrink-0 text-ink-muted" />
            </Link>
          ))}
        </GroupedSection>
      )}

      <h2 className="mb-1.5 px-4 text-small font-medium text-ink-muted">Ways you accept payment</h2>
      <AcceptedMethodsForm businessId={business.id} accepted={rules.accepted_payment_methods} />
      <p className="mt-2 mb-8 px-4 text-small text-ink-muted">
        Shown on your page. Customers pick one when they book, so you know what to expect.
      </p>

      <GroupedSection
        title="Your payment details"
        footer="Shown only to customers who booked you, on their own booking, with a reference to put on the transfer. Never on your public page."
      >
        <PaymentDetailsForm
          businessId={business.id}
          canEdit={role === "owner"}
          values={{
            momoNetwork: details?.momoNetwork ?? "",
            momoNumber: details?.momoNumber ? formatPhoneLocal(details.momoNumber) : "",
            momoName: details?.momoName ?? "",
            bankName: details?.bankName ?? "",
            bankAccountName: details?.bankAccountName ?? "",
            bankAccountNumber: details?.bankAccountNumber ?? "",
          }}
        />
      </GroupedSection>
    </>
  );
}
