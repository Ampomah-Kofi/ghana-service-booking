import type { Metadata } from "next";
import { Sheet } from "@/components/ui/sheet";
import { ReviewForm } from "@/components/reviews/review-form";
import { ReviewCard } from "@/components/reviews/review-card";
import { myReviewFor } from "@/server/reviews/reviews";
import { Toast } from "@/components/ui/toast";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/bookings/status-badge";
import { formatDateShort, formatTime } from "@/lib/datetime";
import { formatMoney, formatPrice } from "@/lib/money";
import { formatPhoneInternational } from "@/lib/phone";
import { businessPageUrl, mapsSearchUrl, mapsUrl, telUrl, whatsappChatUrl } from "@/lib/share";
import { publicEnv } from "@/lib/public-env";
import { formatPlace, getBusinessBySlug } from "@/server/businesses/queries";
import { ShareButton } from "@/components/ui/share-button";
import { CalendarPlusIcon, ChatIcon, NavigationIcon, PhoneIcon, ShareIcon } from "@/components/ui/icons";
import { rebookHref } from "@/lib/rebook";
import { requireUserOrRedirect } from "@/server/auth/session";
import { customerCanChange, getAppointment } from "@/server/bookings/appointments";
import { createUserClient } from "@/server/db/supabase-server";
import { CancelBookingForm } from "./cancel-form";
import { PaymentSummary } from "@/components/bookings/payment-summary";
import { listAppointmentPayments } from "@/server/payments/service";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUserOrRedirect(`/bookings/${id}`);
  const db = await createUserClient();
  const appointment = await getAppointment(db, id);
  // This is the customer's page; providers manage bookings from their dashboard.
  if (!appointment || appointment.customerUserId !== user.id) notFound();

  const a = appointment;
  const tz = a.business.timezone ?? "UTC";
  const money = (amountMinor: number) =>
    formatMoney({ amountMinor, currency: a.price.currency.code }, a.price.currency);
  const canChange = customerCanChange(a);
  const live = a.status === "pending" || a.status === "confirmed" || a.status === "arrived";
  const justBooked = sp.booked === "1" || sp.payment === "paid";
  const payments = await listAppointmentPayments(db, a.id);
  const business = a.business.slug ? await getBusinessBySlug(db, a.business.slug) : null;
  const loc = business?.location ?? null;
  const where = [loc?.addressLine, formatPlace(loc)].filter(Boolean).join(", ") || null;
  const landmark = loc?.landmark ?? null;
  const directions = loc
    ? loc.lat != null && loc.lng != null
      ? mapsUrl(loc.lat, loc.lng)
      : mapsSearchUrl([a.business.name, where].filter(Boolean).join(", "))
    : null;
  const myReview = a.status === "completed" ? await myReviewFor(db, user.id, a.id) : null;
  const shareUrl = a.business.slug ? businessPageUrl(publicEnv().NEXT_PUBLIC_SITE_URL, a.business.slug) : null;

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
              : "The business will confirm it soon. We'll let you know."}
          </p>
        </section>
      ) : sp.rescheduled === "1" ? (
        <Toast message="Your booking has been moved" param="rescheduled" />
      ) : sp.cancelled === "1" ? (
        <Toast message="Your booking is cancelled" param="cancelled" />
      ) : null}

      {/* The booking as a ticket (ADR-0012): what, when, where, then a tear line and the details. */}
      <article
        aria-labelledby="ticket-title"
        className={`mb-6 overflow-hidden rounded-card bg-card lift ${a.status === "cancelled" ? "opacity-75" : ""}`}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-small font-semibold">
              {a.business.slug ? (
                <Link href={`/business/${a.business.slug}`} className="text-primary">
                  {a.business.name}
                </Link>
              ) : (
                (a.business.name ?? "Business")
              )}
            </p>
            <StatusBadge status={a.status} />
          </div>
          <h1 id="ticket-title" className="text-title font-bold">
            {a.serviceName}
          </h1>
          {a.staffName ? <p className="text-body text-ink-muted">with {a.staffName}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">Date</p>
              <p className={`text-heading font-bold ${a.status === "cancelled" ? "line-through" : ""}`}>
                {formatDateShort(a.startsAt, tz)}
              </p>
            </div>
            <div>
              <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">Time</p>
              <p className={`text-heading font-bold tabular-nums ${a.status === "cancelled" ? "line-through" : ""}`}>
                {formatTime(a.startsAt, tz)}
              </p>
              <p className="text-small text-ink-muted tabular-nums">until {formatTime(a.endsAt, tz)}</p>
            </div>
          </div>
          {where ? (
            <div className="mt-3">
              <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">Where</p>
              <p className="text-body">{where}</p>
              {landmark ? <p className="text-small text-ink-muted">{landmark}</p> : null}
            </div>
          ) : null}
        </div>

        <div aria-hidden="true" className="relative h-5">
          <span className="absolute top-0 -left-2.5 size-5 rounded-full bg-surface" />
          <span className="absolute top-0 -right-2.5 size-5 rounded-full bg-surface" />
          <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-border" />
        </div>

        <dl className="ios-list">
          <Row label="Price">{formatPrice(a.price.amountMinor, a.price.type, a.price.currency)}</Row>
          <Row label="Booked as">
            <span className="block">{a.customerName}</span>
            {a.customerPhone ? (
              <span className="block whitespace-nowrap text-ink-muted tabular-nums">
                {formatPhoneInternational(a.customerPhone)}
              </span>
            ) : null}
          </Row>
          {a.note ? <Row label="Your note">{a.note}</Row> : null}
          {a.status === "cancelled" && a.cancellationReason ? <Row label="Reason">{a.cancellationReason}</Row> : null}
        </dl>

        <nav
          aria-label="Booking actions"
          className="grid grid-flow-col auto-cols-fr gap-1 border-t border-border px-2 py-3"
        >
          {live ? (
            <a href={`/bookings/${a.id}/ics`} download aria-label="Add to calendar" className={ACTION}>
              <span className={ACTION_ICON}>
                <CalendarPlusIcon />
              </span>
              Calendar
            </a>
          ) : null}
          {directions ? (
            <a href={directions} target="_blank" rel="noopener noreferrer" className={ACTION}>
              <span className={ACTION_ICON}>
                <NavigationIcon />
              </span>
              Directions
            </a>
          ) : null}
          {a.business.phone ? (
            <a href={telUrl(a.business.phone)} className={ACTION}>
              <span className={ACTION_ICON}>
                <PhoneIcon />
              </span>
              Call
            </a>
          ) : null}
          {a.business.whatsapp ? (
            <a href={whatsappChatUrl(a.business.whatsapp)} target="_blank" rel="noopener noreferrer" className={ACTION}>
              <span className={ACTION_ICON}>
                <ChatIcon className="text-whatsapp" />
              </span>
              WhatsApp
            </a>
          ) : null}
          {shareUrl ? (
            <ShareButton
              url={shareUrl}
              title={a.business.name ?? "Booking"}
              text={`I'm booked at ${a.business.name} on ${formatDateShort(a.startsAt, tz)} at ${formatTime(a.startsAt, tz)}.`}
              className={ACTION}
            >
              <span className={ACTION_ICON}>
                <ShareIcon />
              </span>
              Share
            </ShareButton>
          ) : null}
        </nav>
      </article>

      {sp.payment === "failed" ? (
        <p role="alert" className="mb-4 rounded-control bg-danger/10 px-3 py-2 text-small text-danger">
          The payment didn&apos;t go through. You can try again below.
        </p>
      ) : null}
      <PaymentSummary
        appointmentId={a.id}
        payments={payments}
        priceMinor={a.finalPriceMinor ?? a.price.amountMinor}
        depositMinor={a.depositMinor}
        holdExpiresAt={a.holdExpiresAt}
        canPayRest={a.business.allowFullPaymentOnline && a.price.type === "fixed"}
        live={a.status === "pending" || a.status === "confirmed"}
        money={money}
      />

      {a.status === "completed" ? (
        <section
          id="rate"
          aria-labelledby="rate-heading"
          className="mb-6 scroll-mt-4 overflow-hidden rounded-card bg-card lift"
        >
          {myReview ? (
            <>
              <h2 id="rate-heading" className="px-4 pt-4 text-heading font-semibold">
                Your review
              </h2>
              <ReviewCard
                review={myReview}
                businessName={a.business.name ?? "the business"}
                canReport={false}
                footer={
                  myReview.editableUntil ? (
                    <button
                      type="button"
                      popoverTarget="edit-review"
                      className="inline-flex min-h-9 items-center text-small font-semibold text-primary"
                    >
                      Edit review
                    </button>
                  ) : myReview.status !== "published" ? (
                    <span className="text-caption text-ink-muted">Hidden after a report</span>
                  ) : undefined
                }
              />
              {myReview.editableUntil ? (
                <Sheet id="edit-review" title="Edit your review">
                  <ReviewForm
                    appointmentId={a.id}
                    review={{ id: myReview.id, rating: myReview.rating, body: myReview.body }}
                    businessName={a.business.name ?? "the business"}
                  />
                </Sheet>
              ) : null}
            </>
          ) : (
            <div className="p-4">
              <h2 id="rate-heading" className="text-title font-bold">
                How was {a.serviceName}?
              </h2>
              <p className="mb-3 text-small text-ink-muted">
                Your review helps others choose, and helps {a.business.name} improve.
              </p>
              <ReviewForm appointmentId={a.id} businessName={a.business.name ?? "the business"} />
            </div>
          )}
        </section>
      ) : null}

      {canChange && a.business.slug ? (
        <section className="grid grid-cols-[minmax(0,1fr)] gap-2" aria-label="Change this booking">
          <Link
            href={`/business/${a.business.slug}/book?reschedule=${a.id}`}
            className="pressable flex min-h-12 items-center justify-center rounded-full bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover"
          >
            Change time
          </Link>
          <CancelBookingForm
            appointmentId={a.id}
            summary={`${a.serviceName} at ${a.business.name ?? "the business"} on ${formatDateShort(a.startsAt, tz)} at ${formatTime(a.startsAt, tz)} will be cancelled and the time given to someone else.`}
          />
        </section>
      ) : !live && a.business.slug ? (
        <Link
          href={rebookHref(a.business.slug, a.serviceId, a.staffId)}
          // While the visit still waits for a rating, "Post review" is the one green button on screen.
          className={`pressable flex min-h-12 items-center justify-center rounded-full px-5 font-semibold ${
            a.status === "completed" && !myReview
              ? "bg-fill text-primary hover:bg-ink/10"
              : "bg-primary text-on-primary hover:bg-primary-hover"
          }`}
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

const ACTION = "pressable flex min-w-0 flex-col items-center gap-1.5 text-center text-caption font-medium";
const ACTION_ICON = "flex size-11 items-center justify-center rounded-full bg-fill text-primary";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-3 text-body">
      <dt className="w-24 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
