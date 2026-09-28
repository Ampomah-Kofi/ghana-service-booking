import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { PayForm } from "@/components/booking/pay-form";
import { formatDateShort, formatTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { formatPhoneLocal } from "@/lib/phone";
import { rebookHref } from "@/lib/rebook";
import { requireUserOrRedirect } from "@/server/auth/session";
import { getAppointment } from "@/server/bookings/appointments";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
import { getPaymentProvider } from "@/server/payments";
import { listAppointmentPayments } from "@/server/payments/service";
import { payAction } from "./actions";

export const metadata: Metadata = { title: "Pay" };

/**
 * Pay a deposit (or the full price, where the business allows it) with Mobile Money, card or bank
 * transfer (Phase 9). While a Mobile Money prompt is out, the page waits and refreshes itself.
 */
export default async function PayPage({ params, searchParams }: PageProps<"/bookings/[id]/pay">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUserOrRedirect(`/bookings/${id}/pay`);
  const db = await createUserClient();
  const a = await getAppointment(db, id);
  if (!a || a.customerUserId !== user.id) notFound();

  const payments = await listAppointmentPayments(db, a.id);
  const paidMinor = payments
    .filter((p) => p.status === "paid" || p.status === "refund_pending")
    .reduce((sum, p) => sum + p.amountMinor, 0);
  const kind: "deposit" | "full" = sp.kind === "full" ? "full" : "deposit";
  const dueMinor =
    kind === "deposit" ? (paidMinor === 0 ? (a.depositMinor ?? 0) : 0) : Math.max(0, a.price.amountMinor - paidMinor);
  const money = (m: number) => formatMoney({ amountMinor: m, currency: a.price.currency.code }, a.price.currency);
  const tz = a.business.timezone ?? "UTC";
  const now = new Date();
  const holdOver = a.holdExpiresAt !== null && new Date(a.holdExpiresAt) <= now;

  // Done (or nothing to pay): back to the ticket.
  if (a.status === "cancelled" && a.cancellationReason === "Payment not completed in time") {
    return (
      <Shell title="Time's up">
        <p className="mb-6 text-body text-ink-muted">
          The time to pay the deposit ran out, so the slot was released. You haven&apos;t been charged.
        </p>
        {a.business.slug ? (
          <Link
            href={rebookHref(a.business.slug, a.serviceId, a.staffId)}
            className="pressable flex min-h-12 items-center justify-center rounded-full bg-primary font-semibold text-on-primary"
          >
            Book again
          </Link>
        ) : null}
      </Shell>
    );
  }
  if (dueMinor <= 0 || (a.holdExpiresAt === null && kind === "deposit" && paidMinor > 0)) {
    redirect(`/bookings/${a.id}?payment=paid`);
  }
  if (!getPaymentProvider() || (a.status !== "pending" && a.status !== "confirmed") || holdOver) {
    redirect(`/bookings/${a.id}`);
  }

  const pending = payments.findLast((p) => p.status === "pending");
  const failed = payments.at(-1)?.status === "failed" ? payments.at(-1) : undefined;
  const waiting = sp.waiting === "1" && pending !== undefined;
  const devApprove =
    waiting && serverEnv().APP_ENV !== "production" && getPaymentProvider()?.id === "mock" && pending?.reference
      ? `/dev/mock-pay/${encodeURIComponent(pending.reference)}`
      : null;
  const policy =
    kind === "deposit"
      ? `Free to cancel online up to ${a.business.cancellationWindowHours ?? 2} hours before: your deposit comes back. ${
          a.business.refundDepositOnNoShow
            ? "If you don't come, it's refunded too."
            : "If you don't come, the business keeps it."
        }`
      : "Cancel online in time and you get the money back.";

  return (
    <Shell title={waiting ? "Approve on your phone" : kind === "deposit" ? "Pay the deposit" : "Pay now"}>
      <section className="mb-5 rounded-card bg-card p-5 lift" aria-label="What you're paying">
        <p className="text-small text-ink-muted">
          {a.serviceName} · {a.business.name} · {formatDateShort(a.startsAt, tz)}, {formatTime(a.startsAt, tz)}
        </p>
        <p className="mt-1 text-display font-bold tabular-nums">{money(dueMinor)}</p>
        <p className="text-small text-ink-muted">
          {kind === "deposit"
            ? `Deposit to hold your time. The rest (${money(a.price.amountMinor - (a.depositMinor ?? 0))}) is paid at the visit.`
            : "The full price, paid now."}
        </p>
        {a.holdExpiresAt ? (
          <p className="mt-3 inline-flex rounded-full bg-accent-soft px-3 py-1 text-small font-semibold text-accent-ink">
            <HoldCountdown until={a.holdExpiresAt} watch={waiting} />
          </p>
        ) : null}
      </section>

      {waiting ? (
        <section className="rounded-card bg-card p-5 text-center lift" aria-live="polite">
          <span aria-hidden="true" className="live-dot mx-auto mb-3 block size-3 rounded-full bg-primary" />
          <p className="text-heading font-semibold">Check your phone</p>
          <p className="mt-1 text-body text-ink-muted">
            Approve {money(pending!.amountMinor)} on{" "}
            {a.customerPhone ? formatPhoneLocal(a.customerPhone) : "your Mobile Money number"}. This page updates by
            itself.
          </p>
          {devApprove ? (
            <Link
              href={devApprove}
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-warning/12 px-4 text-small font-semibold text-warning"
            >
              Dev only: open the mock phone prompt
            </Link>
          ) : null}
          <Link
            href={`/bookings/${a.id}/pay?kind=${kind}`}
            className="mt-4 block min-h-11 content-center text-small text-primary"
          >
            Didn&apos;t get a prompt? Try again
          </Link>
        </section>
      ) : (
        <>
          {failed ? (
            <p role="alert" className="mb-4 rounded-control bg-danger/10 px-3 py-2 text-small text-danger">
              That payment didn&apos;t go through{failed.failureReason ? `: ${failed.failureReason}` : ""}. Please try
              again.
            </p>
          ) : null}
          <PayForm
            action={payAction.bind(null, a.id)}
            kind={kind}
            amountLabel={money(dueMinor)}
            defaultPhone={a.customerPhone ? formatPhoneLocal(a.customerPhone) : ""}
          />
          <p className="mt-4 text-small text-ink-muted">{policy}</p>
        </>
      )}
      <Link
        href={`/bookings/${a.id}`}
        className="mt-6 block min-h-11 content-center text-center text-small text-primary"
      >
        Back to your booking
      </Link>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-3">
      <h1 className="mb-4 text-display font-bold">{title}</h1>
      {children}
    </div>
  );
}
