import type { Metadata } from "next";
import { Toast } from "@/components/ui/toast";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/bookings/status-badge";
import { formatDateShort, formatTime } from "@/lib/datetime";
import { formatMoney, formatPrice } from "@/lib/money";
import { formatPhoneInternational } from "@/lib/phone";
import { telUrl, whatsappChatUrl } from "@/lib/share";
import { rebookHref } from "@/lib/rebook";
import { requireUserOrRedirect } from "@/server/auth/session";
import { customerCanChange, getAppointment } from "@/server/bookings/appointments";
import { createUserClient } from "@/server/db/supabase-server";
import { CancelBookingForm } from "./cancel-form";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUserOrRedirect(`/bookings/${id}`);
  const appointment = await getAppointment(await createUserClient(), id);
  // This is the customer's page; providers manage bookings from their dashboard.
  if (!appointment || appointment.customerUserId !== user.id) notFound();

  const a = appointment;
  const tz = a.business.timezone ?? "UTC";
  const money = (amountMinor: number) =>
    formatMoney({ amountMinor, currency: a.price.currency.code }, a.price.currency);
  const canChange = customerCanChange(a);
  const live = a.status === "pending" || a.status === "confirmed" || a.status === "arrived";
  const justBooked = sp.booked === "1";

  return (
    <>
      {justBooked ? (
        <section
          className="sheet-up mb-6 rounded-card bg-primary px-5 py-7 text-center text-on-primary"
          aria-live="polite"
        >
          <svg viewBox="0 0 64 64" className="pop mx-auto mb-3 size-16" aria-hidden="true">
            <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.18" />
            <path
              className="draw"
              d="m20 33 8 8 16-18"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h2 className="text-display font-bold">{a.status === "confirmed" ? "You're booked!" : "Request sent"}</h2>
          <p className="mt-1 text-body opacity-90">
            {a.status === "confirmed"
              ? `${formatDateShort(a.startsAt, tz)} at ${formatTime(a.startsAt, tz)}. See you then.`
              : "The business will confirm it soon."}
          </p>
        </section>
      ) : sp.rescheduled === "1" ? (
        <Toast message="Your booking has been moved" param="rescheduled" />
      ) : sp.cancelled === "1" ? (
        <Toast message="Your booking is cancelled" param="cancelled" />
      ) : null}

      <div className="mb-2">
        <StatusBadge status={a.status} />
      </div>
      <h1 className="mb-1 text-display font-bold">{a.serviceName}</h1>
      <p className="mb-6 text-body text-ink-muted">
        {a.business.slug ? (
          <Link href={`/business/${a.business.slug}`} className="font-medium text-primary">
            {a.business.name}
          </Link>
        ) : (
          (a.business.name ?? "Business")
        )}
      </p>

      <dl className="mb-6 ios-list overflow-hidden rounded-card bg-card lift">
        <Row label="Date">{formatDateShort(a.startsAt, tz)}</Row>
        <Row label="Time">
          <span className="tabular-nums">
            {formatTime(a.startsAt, tz)} – {formatTime(a.endsAt, tz)}
          </span>
        </Row>
        {a.staffName ? <Row label="With">{a.staffName}</Row> : null}
        <Row label="Price">{formatPrice(a.price.amountMinor, a.price.type, a.price.currency)}</Row>
        {a.depositMinor ? (
          <Row label="Deposit">
            {money(a.depositMinor)} · {a.paymentStatus === "paid" ? "paid" : "the business will tell you how to pay"}
          </Row>
        ) : null}
        <Row label="Booked as">
          {a.customerName}
          {a.customerPhone ? `, ${formatPhoneInternational(a.customerPhone)}` : ""}
        </Row>
        {a.note ? <Row label="Your note">{a.note}</Row> : null}
        {a.status === "cancelled" && a.cancellationReason ? <Row label="Reason">{a.cancellationReason}</Row> : null}
      </dl>

      {a.business.phone || a.business.whatsapp ? (
        <section className="mb-6 grid grid-cols-2 gap-2" aria-label="Contact the business">
          {a.business.phone ? (
            <a
              href={telUrl(a.business.phone)}
              className="flex min-h-11 items-center justify-center rounded-full bg-fill px-3 text-body font-semibold text-primary"
            >
              Call
            </a>
          ) : null}
          {a.business.whatsapp ? (
            <a
              href={whatsappChatUrl(a.business.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center rounded-full bg-fill px-3 text-body font-semibold text-primary"
            >
              WhatsApp
            </a>
          ) : null}
        </section>
      ) : null}

      {canChange && a.business.slug ? (
        <section className="grid gap-3" aria-label="Change this booking">
          <Link
            href={`/business/${a.business.slug}/book?reschedule=${a.id}`}
            className="flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-body font-semibold text-on-primary"
          >
            Change time
          </Link>
          <CancelBookingForm appointmentId={a.id} />
        </section>
      ) : !live && a.business.slug ? (
        <Link
          href={rebookHref(a.business.slug, a.serviceId, a.staffId)}
          className="pressable flex min-h-12 items-center justify-center rounded-full bg-primary px-4 text-body font-semibold text-on-primary hover:bg-primary-hover"
        >
          Book again
        </Link>
      ) : live ? (
        <p className="text-center text-small text-ink-muted">
          It&apos;s too late to change this booking online. Please contact the business.
        </p>
      ) : null}

      <p className="mt-6 text-center">
        <Link href="/bookings" className="inline-flex min-h-11 items-center font-medium text-primary">
          All your bookings
        </Link>
      </p>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-body">
      <dt className="w-24 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
