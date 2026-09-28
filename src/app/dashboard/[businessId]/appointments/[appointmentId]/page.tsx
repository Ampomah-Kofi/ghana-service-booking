import type { Metadata } from "next";
import { Toast } from "@/components/ui/toast";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PaymentBadge, SourceBadge, STATUS, StatusBadge } from "@/components/bookings/status-badge";
import { ChatIcon, ChevronLeftIcon, ChevronRightIcon, PhoneIcon } from "@/components/ui/icons";
import { localDateOf } from "@/lib/availability";
import { formatDateShort, formatDateTime, formatTime } from "@/lib/datetime";
import { formatDuration } from "@/lib/hours";
import { formatMoney, formatPrice, minorToInput } from "@/lib/money";
import { AppointmentPayments } from "@/components/payments/appointment-payments";
import { paymentMethodLabel } from "@/components/bookings/payment-summary";
import { listAppointmentPayments } from "@/server/payments/service";
import { formatPhoneInternational } from "@/lib/phone";
import { telUrl, whatsappChatUrl } from "@/lib/share";
import { memberBusinessOr404 } from "@/server/businesses/access";
import { getAppointment, getAppointmentHistory } from "@/server/bookings/appointments";
import { nextStatuses, undoStatus } from "@/server/bookings/manage";
import { AppointmentActions } from "./appointment-actions";

export const metadata: Metadata = { title: "Appointment" };

const SOURCE = { online: "Booked online", manual: "Added by the business", walk_in: "Walk-in" } as const;

export default async function AppointmentPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/appointments/[appointmentId]">) {
  const { businessId, appointmentId } = await params;
  const sp = await searchParams;
  const { db, business, canManage } = await memberBusinessOr404(businessId);
  const a = await getAppointment(db, appointmentId);
  if (!a || a.business.id !== business.id) notFound();
  const [history, payments] = await Promise.all([
    getAppointmentHistory(db, a.id),
    canManage ? listAppointmentPayments(db, a.id) : Promise.resolve([]),
  ]);

  const tz = business.timezone;
  const base = `/dashboard/${business.id}`;
  const date = localDateOf(new Date(a.startsAt), tz);
  const money = (minor: number) =>
    formatMoney({ amountMinor: minor, currency: a.price.currency.code }, a.price.currency);
  const actions = nextStatuses(a.status, new Date(a.startsAt));
  const undo = undoStatus(a.status, new Date(a.endsAt));
  const minutes = Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000);
  const live = a.status === "pending" || a.status === "confirmed";
  const due = a.finalPriceMinor ?? (a.price.type === "fixed" ? a.price.amountMinor : null);
  const paid = payments
    .filter((p) => p.status === "paid" || p.status === "refund_pending")
    .reduce((s, p) => s + p.amountMinor, 0);
  const left = due === null ? null : Math.max(0, due - paid);
  const moneySummary = !canManage
    ? a.paymentStatus === "paid"
      ? "Paid in full."
      : a.paymentStatus === "partially_paid"
        ? "Part paid. Ask the owner what's left."
        : null
    : paid === 0
      ? null
      : left === null
        ? `${money(paid)} paid`
        : left === 0
          ? `Paid in full · ${money(paid)}`
          : `${money(paid)} paid · ${money(left)} to collect`;
  const shownPayments = payments.filter((p) => p.status !== "failed" && p.status !== "expired");
  const kept = ["arrived", "completed", "confirmed", "pending"].includes(a.status);

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`${base}/calendar${date === localDateOf(new Date(), tz) ? "" : `?date=${date}`}`}
        className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-0.5 text-small font-medium text-primary"
      >
        <ChevronLeftIcon /> Calendar
      </Link>
      {sp.moved === "1" ? <Toast message="Appointment moved" param="moved" /> : null}

      <article className="overflow-hidden rounded-card bg-card lift">
        <div aria-hidden="true" className={`h-1.5 ${STATUS[a.status].bar}`} />
        <div className="p-5">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <StatusBadge status={a.status} />
            <SourceBadge source={a.source} />
            <PaymentBadge status={a.paymentStatus} paying={a.holdExpiresAt !== null} />
          </div>
          <h1 className="text-display font-bold">{a.customerName}</h1>
          <p
            className={`text-body tabular-nums ${a.status === "cancelled" ? "text-ink-muted line-through" : "text-ink-muted"}`}
          >
            {formatDateShort(a.startsAt, tz)} · {formatTime(a.startsAt, tz)} – {formatTime(a.endsAt, tz)}
          </p>

          {a.customerPhone ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={telUrl(a.customerPhone)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-fill font-semibold hover:bg-ink/10"
              >
                <PhoneIcon /> Call
              </a>
              <a
                href={whatsappChatUrl(a.customerPhone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-fill font-semibold text-whatsapp hover:bg-ink/10"
              >
                <ChatIcon /> WhatsApp
              </a>
            </div>
          ) : null}
        </div>

        <dl className="ios-list border-t border-border">
          <Row label="Service">
            {a.serviceName} · {formatDuration(minutes)}
          </Row>
          {a.staffName ? <Row label="With">{a.staffName}</Row> : null}
          <Row label="Price">
            {a.finalPriceMinor !== null ? (
              <>
                <span className="font-semibold tabular-nums">{money(a.finalPriceMinor)}</span>{" "}
                <span className="text-small text-ink-muted">
                  paid (listed {formatPrice(a.price.amountMinor, a.price.type, a.price.currency)})
                </span>
              </>
            ) : (
              <span className="font-semibold tabular-nums">
                {formatPrice(a.price.amountMinor, a.price.type, a.price.currency)}
              </span>
            )}
          </Row>
          {a.depositMinor ? <Row label="Deposit">{money(a.depositMinor)}</Row> : null}
          {a.holdExpiresAt ? <Row label="Waiting">Customer is paying the deposit</Row> : null}
          {a.customerPhone ? <Row label="Phone">{formatPhoneInternational(a.customerPhone)}</Row> : null}
          {a.note ? <Row label="Note">{a.note}</Row> : null}
          <Row label="Booked">{`${SOURCE[a.source]} · ${formatDateTime(a.createdAt, tz)}`}</Row>
          {a.status === "cancelled" && a.cancellationReason ? <Row label="Reason">{a.cancellationReason}</Row> : null}
        </dl>
      </article>

      <AppointmentPayments
        businessId={business.id}
        appointmentId={a.id}
        canRecord={kept && !a.holdExpiresAt && left !== 0 && a.paymentStatus !== "paid"}
        canSeeMoney={canManage}
        currencySymbol={a.price.currency.symbol ?? a.price.currency.code}
        leftInput={canManage && left ? minorToInput(left, a.price.currency.minorUnit) : ""}
        summary={moneySummary}
        lines={shownPayments.map((p) => ({
          id: p.id,
          label: `${p.kind === "deposit" ? "Deposit" : p.kind === "balance" ? "Balance" : "Payment"} · ${paymentMethodLabel(p)}`,
          status:
            p.status === "paid"
              ? "Paid"
              : p.status === "pending"
                ? "Waiting for the customer"
                : p.status === "refund_pending"
                  ? "Refund on its way"
                  : "Refunded",
          tone: p.status === "paid" ? "text-success" : p.status === "pending" ? "text-warning" : "text-info",
          amount: money(p.amountMinor),
          refundable: p.status === "paid",
          note: p.note,
        }))}
      />

      <section aria-label="Actions" className="mt-4 grid gap-2">
        <AppointmentActions
          businessId={business.id}
          appointmentId={a.id}
          actions={actions}
          undo={undo ? { status: undo, label: a.status === "completed" ? "Undo complete" : "Undo no-show" } : null}
          askFinalPrice={a.price.type === "from" || a.price.type === "on_request"}
          currencySymbol={a.price.currency.symbol ?? a.price.currency.code}
          cancelSummary={`${a.customerName}'s ${a.serviceName} on ${formatDateShort(a.startsAt, tz)} at ${formatTime(a.startsAt, tz)}`}
        />
        {canManage && live ? (
          <Link
            href={`${base}/appointments/${a.id}/move`}
            className="flex min-h-12 items-center justify-center rounded-full bg-fill font-semibold hover:bg-ink/10"
          >
            Move or reassign
          </Link>
        ) : null}
        {canManage && a.clientId ? (
          <Link
            href={`${base}/clients/${a.clientId}`}
            className="flex min-h-12 items-center justify-between rounded-control px-1 text-body text-primary"
          >
            Client history and notes <ChevronRightIcon />
          </Link>
        ) : null}
      </section>

      <section aria-labelledby="history-heading" className="mt-6">
        <h2 id="history-heading" className="mb-2 text-heading font-semibold">
          History
        </h2>
        <ol className="relative ml-2 border-l border-border">
          {history.map((h) => (
            <li key={h.id} className="relative pb-4 pl-5 last:pb-0">
              <span
                aria-hidden="true"
                className={`absolute top-1.5 -left-1 size-2 rounded-full ${STATUS[h.toStatus].bar}`}
              />
              <p className="text-body">
                {h.fromStatus === h.toStatus ? (h.reason ?? "Changed") : STATUS[h.toStatus].label}
                {h.fromStatus !== h.toStatus && h.reason ? <span className="text-ink-muted"> · {h.reason}</span> : null}
              </p>
              <p className="text-small text-ink-muted">{formatDateTime(h.at, tz)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-3 text-body">
      <dt className="w-20 shrink-0 text-small leading-6 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
