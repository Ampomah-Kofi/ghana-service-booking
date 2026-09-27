import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/bookings/status-badge";
import { FormMessage } from "@/components/ui/field";
import { formatDayLong, formatTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { formatPhoneInternational } from "@/lib/phone";
import { telUrl, whatsappChatUrl } from "@/lib/share";
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
        <FormMessage
          tone="notice"
          message={
            a.status === "confirmed" ? "You're booked! See you then." : "Request sent. The business will confirm it."
          }
        />
      ) : sp.rescheduled === "1" ? (
        <FormMessage tone="notice" message="Your booking has been moved." />
      ) : null}

      <div className="mb-2">
        <StatusBadge status={a.status} />
      </div>
      <h1 className="mb-1 text-large-title font-bold tracking-tight">{a.serviceName}</h1>
      <p className="mb-6 text-body text-text-secondary">
        {a.business.slug ? (
          <Link href={`/business/${a.business.slug}`} className="font-medium text-accent">
            {a.business.name}
          </Link>
        ) : (
          (a.business.name ?? "Business")
        )}
      </p>

      <dl className="mb-6 divide-y divide-separator overflow-hidden rounded-card bg-surface-elevated shadow-card">
        <Row label="Date">{formatDayLong(a.startsAt, tz)}</Row>
        <Row label="Time">
          <span className="tabular-nums">
            {formatTime(a.startsAt, tz)}–{formatTime(a.endsAt, tz)}
          </span>
        </Row>
        {a.staffName ? <Row label="With">{a.staffName}</Row> : null}
        <Row label="Price">
          {a.price.type === "from" ? "from " : ""}
          {money(a.price.amountMinor)}
        </Row>
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
              className="flex min-h-11 items-center justify-center rounded-control bg-surface-elevated px-3 text-body font-semibold text-accent shadow-card"
            >
              Call
            </a>
          ) : null}
          {a.business.whatsapp ? (
            <a
              href={whatsappChatUrl(a.business.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center rounded-control bg-surface-elevated px-3 text-body font-semibold text-accent shadow-card"
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
            className="flex min-h-11 items-center justify-center rounded-control bg-accent px-4 text-body font-semibold text-on-accent"
          >
            Change time
          </Link>
          <CancelBookingForm appointmentId={a.id} />
        </section>
      ) : live ? (
        <p className="text-center text-footnote text-text-secondary">
          It&apos;s too late to change this booking online. Please contact the business.
        </p>
      ) : null}

      <p className="mt-6 text-center">
        <Link href="/bookings" className="inline-flex min-h-11 items-center font-medium text-accent">
          All your bookings
        </Link>
      </p>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-body">
      <dt className="w-24 shrink-0 text-text-secondary">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
