import type { Metadata } from "next";
import { Toast } from "@/components/ui/toast";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SourceBadge, STATUS, StatusBadge } from "@/components/bookings/status-badge";
import { ChatIcon, ChevronLeftIcon, ChevronRightIcon, PhoneIcon } from "@/components/ui/icons";
import { localDateOf } from "@/lib/availability";
import { formatDateShort, formatDateTime, formatTime } from "@/lib/datetime";
import { formatDuration } from "@/lib/hours";
import { formatMoney, formatPrice } from "@/lib/money";
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
  const history = await getAppointmentHistory(db, a.id);

  const tz = business.timezone;
  const base = `/dashboard/${business.id}`;
  const date = localDateOf(new Date(a.startsAt), tz);
  const money = (minor: number) =>
    formatMoney({ amountMinor: minor, currency: a.price.currency.code }, a.price.currency);
  const actions = nextStatuses(a.status, new Date(a.startsAt));
  const undo = undoStatus(a.status, new Date(a.endsAt));
  const minutes = Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000);
  const live = a.status === "pending" || a.status === "confirmed";

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
          {a.customerPhone ? <Row label="Phone">{formatPhoneInternational(a.customerPhone)}</Row> : null}
          {a.note ? <Row label="Note">{a.note}</Row> : null}
          <Row label="Booked">{`${SOURCE[a.source]} · ${formatDateTime(a.createdAt, tz)}`}</Row>
          {a.status === "cancelled" && a.cancellationReason ? <Row label="Reason">{a.cancellationReason}</Row> : null}
        </dl>
      </article>

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
