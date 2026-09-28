import type { Metadata } from "next";
import { acceptedSummary } from "@/lib/payment-methods";
import Link from "next/link";
import { PriceTag } from "@/components/business/price-tag";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cache } from "react";
import { BookingBar, StepIndicator, type BookingSummary } from "@/components/booking/booking-bar";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { formatDuration } from "@/lib/hours";
import { formatPrice } from "@/lib/money";
import { dayPill, formatDateShort, formatLocalDate, formatLocalDateShort, formatTime } from "@/lib/datetime";
import { CenterSelected } from "@/components/booking/center-selected";
import { DateJump } from "@/components/booking/date-jump";
import { groupByPartOfDay } from "@/lib/availability";
import { localDateSchema } from "@/schemas/booking";
import { getCurrentUser } from "@/server/auth/session";
import { customerCanChange, getAppointment, type AppointmentView } from "@/server/bookings/appointments";
import { formatPlace, getBusinessBySlug, type BusinessView } from "@/server/businesses/queries";
import { createUserClient } from "@/server/db/supabase-server";
import { getMyProfile } from "@/server/profiles/profile";
import {
  DAYS_PER_PAGE,
  candidatesFor,
  getAvailability,
  getBookingSetup,
  lastBookableDate,
  staffForService,
  todayIn,
} from "@/server/scheduling/availability";
import { BookingDetailsForm, ConfirmRescheduleForm } from "./booking-forms";

export const metadata: Metadata = { title: "Book", robots: { index: false } };

const loadBusiness = cache(async (slug: string) => getBusinessBySlug(await createUserClient(), slug));

type Query = { service?: string; staff?: string; date?: string; from?: string; time?: string; reschedule?: string };

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length <= 100 ? value : undefined;
}

function bookHref(slug: string, query: Query): string {
  const params = new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  const search = params.toString();
  return `/business/${slug}/book${search ? `?${search}` : ""}`;
}

/**
 * The booking flow (SPEC §5, docs/design.md §3a): one decision per screen, server-rendered
 * links (works before JavaScript loads), a step indicator and a bottom summary bar.
 */
export default async function BookPage({ params, searchParams }: PageProps<"/business/[slug]/book">) {
  const { slug } = await params;
  const sp = await searchParams;
  const business = await loadBusiness(slug);
  if (!business || business.status !== "published") notFound();

  const db = await createUserClient();
  const user = await getCurrentUser();
  const query: Query = {
    service: one(sp.service),
    staff: one(sp.staff),
    date: one(sp.date),
    from: one(sp.from),
    time: one(sp.time),
    reschedule: one(sp.reschedule),
  };

  // Rescheduling: the service is fixed; only the person and time change.
  let reschedule: AppointmentView | null = null;
  if (query.reschedule) {
    reschedule = user ? await getAppointment(db, query.reschedule) : null;
    if (!reschedule || reschedule.business.id !== business.id || !customerCanChange(reschedule)) {
      return (
        <Shell business={business} title="This booking can't be moved online">
          <Panel>
            It may be too close to the appointment, or already changed. Please contact {business.name} directly.
          </Panel>
          <BackLink href="/bookings">Your bookings</BackLink>
        </Shell>
      );
    }
    query.service = reschedule.serviceId;
  }

  const setup = await getBookingSetup(db, business);
  const service = setup.services.find((s) => s.id === query.service);

  // ── Step 1: service ─────────────────────────────────────────────────────────
  if (!service) {
    const stepsIfTeam = business.kind === "team" ? 4 : 3;
    return (
      <Shell business={business} title="Choose a service" step={{ step: 1, of: stepsIfTeam }}>
        {query.service ? (
          <Panel>That service isn&apos;t available online any more. Please choose another.</Panel>
        ) : null}
        {setup.services.length === 0 ? (
          <Panel>
            {business.name} isn&apos;t taking online bookings yet.{" "}
            <Link href={`/business/${slug}`} className="font-medium text-primary">
              See how to contact them
            </Link>
          </Panel>
        ) : (
          <ul className="ios-list overflow-hidden rounded-card bg-card lift">
            {setup.services.map((s) => (
              <li key={s.id}>
                <Link
                  href={bookHref(slug, { service: s.id })}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-fill active:bg-fill"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium">{s.name}</span>
                    <span className="block text-small text-ink-muted">{formatDuration(s.durationMinutes)}</span>
                  </span>
                  <PriceTag price={formatPrice(s.priceMinor, s.priceType, business.currency)} />
                  <ChevronRightIcon className="shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Shell>
    );
  }

  const eligible = staffForService(setup, service.id);
  const choosesStaff = eligible.length > 1;
  const totalSteps = choosesStaff ? 4 : 3;
  const chosen = eligible.find((s) => s.id === query.staff) ?? null;
  const staffChoice = chosen ? chosen.id : "any";
  const withWhom = chosen?.displayName ?? (eligible.length === 1 ? eligible[0].displayName : "Any available");
  const price = formatPrice(service.priceMinor, service.priceType, business.currency);
  const serviceLine = [service.name, business.kind === "team" && query.staff ? withWhom : null]
    .filter(Boolean)
    .join(" · ");
  const summary = (when?: string): BookingSummary => ({
    title: serviceLine,
    detail: [when, price, formatDuration(service.durationMinutes)].filter(Boolean).join(" · "),
  });
  const base: Query = { service: reschedule ? undefined : service.id, reschedule: reschedule?.id };
  const serviceStepHref = reschedule ? "/bookings" : bookHref(slug, {});

  // ── Step 2: who (team businesses only; solo providers never see this) ──────
  if (choosesStaff && !query.staff) {
    const people = [
      { id: "any", displayName: "Any available professional", roleTitle: "We'll match you with whoever is free" },
      ...eligible,
    ];
    return (
      <Shell
        business={business}
        title="Choose a professional"
        back={serviceStepHref}
        step={{ step: 2, of: totalSteps }}
      >
        <ul className="ios-list overflow-hidden rounded-card bg-card lift">
          {people.map((s) => (
            <li key={s.id}>
              <Link
                href={bookHref(slug, { ...base, staff: s.id })}
                className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-fill active:bg-fill"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full text-heading font-semibold ${
                    s.id === "any" ? "bg-primary-soft text-primary" : "bg-fill text-ink-muted"
                  }`}
                >
                  {s.id === "any" ? "✦" : s.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium">{s.displayName}</span>
                  {s.roleTitle ? <span className="block text-small text-ink-muted">{s.roleTitle}</span> : null}
                </span>
                <ChevronRightIcon className="shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
        <BookingBar summary={summary()} />
      </Shell>
    );
  }

  const withStaff: Query = { ...base, staff: chosen ? chosen.id : choosesStaff ? "any" : undefined };
  const today = todayIn(setup.timezone);
  const lastDate = lastBookableDate(setup);
  const timeStepBack = choosesStaff ? bookHref(slug, base) : serviceStepHref;

  // ── Last step: confirm ──────────────────────────────────────────────────────
  const startsAt = query.time ? new Date(query.time) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime())) {
    const candidates = await candidatesFor(db, setup, { serviceId: service.id, staffId: chosen?.id ?? null, startsAt });
    const timeHref = bookHref(slug, { ...withStaff, date: query.date, from: query.from });
    const step = { step: totalSteps, of: totalSteps };
    if (candidates.length === 0) {
      return (
        <Shell business={business} title="That time is no longer free" back={timeHref} step={step}>
          <Panel>Someone may have just booked it. Please choose another time.</Panel>
          <BackLink href={timeHref}>Choose another time</BackLink>
        </Shell>
      );
    }
    const when = `${formatDateShort(startsAt, setup.timezone)} · ${formatTime(startsAt, setup.timezone)}`;
    const loc = business.location;
    const place = [formatPlace(loc), loc?.landmark ? `near ${loc.landmark}` : null].filter(Boolean).join(" · ");
    const policy =
      setup.rules.cancellationWindowHours > 0
        ? `Free to cancel or change online up to ${setup.rules.cancellationWindowHours} hours before.`
        : "Free to cancel or change online any time before it starts.";
    const details = (
      <dl className="mb-5 ios-list overflow-hidden rounded-card bg-card lift">
        <Row label="Where">
          <span className="block font-medium">{business.name}</span>
          {place ? <span className="block text-small text-ink-muted">{place}</span> : null}
        </Row>
        <Row label="When">{when}</Row>
        <Row label="Service">
          {service.name} · {formatDuration(service.durationMinutes)}
        </Row>
        {business.kind === "team" ? <Row label="With">{withWhom}</Row> : null}
        <Row label="Total">
          <span className="font-semibold tabular-nums">{price}</span>
          {service.priceType === "from" ? (
            <span className="block text-small text-ink-muted">Final price confirmed at the appointment</span>
          ) : service.priceType === "on_request" ? (
            <span className="block text-small text-ink-muted">You agree the price with {business.name}</span>
          ) : null}
        </Row>
        <Row label="Payment">
          <span className="text-small">
            Paid to {business.name} directly: {acceptedSummary(setup.rules.acceptedPaymentMethods)}
          </span>
        </Row>
        <Row label="Policy">
          <span className="text-small">{policy}</span>
        </Row>
      </dl>
    );

    if (reschedule) {
      return (
        <Shell business={business} title="Move your booking?" back={timeHref} step={step}>
          <p className="mb-4 text-body text-ink-muted">
            From {formatDateShort(reschedule.startsAt, setup.timezone)} ·{" "}
            {formatTime(reschedule.startsAt, setup.timezone)}
          </p>
          {details}
          <ConfirmRescheduleForm
            appointmentId={reschedule.id}
            staff={staffChoice}
            startsAt={startsAt.toISOString()}
            summary={summary(when)}
          />
        </Shell>
      );
    }

    if (!user) {
      const next = bookHref(slug, { ...withStaff, date: query.date, time: startsAt.toISOString() });
      return (
        <Shell business={business} title="Almost done" back={timeHref} step={step}>
          {details}
          <Panel>
            Sign in with your phone number to confirm. It takes a minute, and you can manage the booking later.
          </Panel>
          <BookingBar summary={summary(when)}>
            <Link
              href={`/sign-in?next=${encodeURIComponent(next)}`}
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-4 text-body font-semibold text-on-primary hover:bg-primary-hover"
            >
              Sign in to book
            </Link>
          </BookingBar>
        </Shell>
      );
    }

    const profile = await getMyProfile();
    return (
      <Shell business={business} title="Your details" back={timeHref} step={step}>
        {details}
        <BookingDetailsForm
          slug={slug}
          hidden={{
            serviceId: service.id,
            staff: staffChoice,
            startsAt: startsAt.toISOString(),
            idempotencyKey: crypto.randomUUID(),
          }}
          defaults={{ customerName: profile?.fullName ?? "", customerPhone: profile?.phoneE164 ?? user.phone ?? "" }}
          summary={summary(when)}
          paymentMethods={setup.rules.acceptedPaymentMethods}
          businessName={business.name}
        />
        <p className="mt-3 text-center text-small text-ink-muted">
          {setup.rules.autoConfirm
            ? "Your booking is confirmed straight away."
            : `${business.name} will confirm your booking.`}
        </p>
      </Shell>
    );
  }

  // ── Date and time ───────────────────────────────────────────────────────────
  const fromParsed = query.from && localDateSchema.safeParse(query.from).success ? query.from : today;
  const from = fromParsed < today ? today : fromParsed > lastDate ? lastDate : fromParsed;
  const days = (
    await getAvailability(db, setup, {
      serviceId: service.id,
      staffId: chosen?.id ?? null,
      fromDate: from,
      days: DAYS_PER_PAGE,
    })
  ).filter((d) => d.date <= lastDate);
  const selected = days.find((d) => d.date === query.date) ?? days.find((d) => d.slots.length > 0) ?? days[0];
  const nextOpen = selected ? days.find((d) => d.date > selected.date && d.slots.length > 0) : undefined;
  const fromParam = from === today ? undefined : from;

  return (
    <Shell
      business={business}
      title={reschedule ? "Choose a new time" : "Choose a time"}
      back={timeStepBack}
      step={{ step: totalSteps - 1, of: totalSteps }}
    >
      <nav aria-label="Dates" className="mb-4">
        <DateJump
          today={today}
          lastDate={lastDate}
          selected={selected?.date ?? from}
          hrefFor={(d) => bookHref(slug, { ...withStaff, from: d === today ? undefined : d, date: d })}
        />
        <ul id="day-strip" className="rail -mx-5 flex gap-1 overflow-x-auto px-5 pb-1">
          {days.map((d) => {
            const pill = dayPill(d.date);
            const isSelected = d.date === selected?.date;
            const isToday = d.date === today;
            const open = d.slots.length > 0;
            const label = `${formatLocalDate(d.date)}${open ? `, ${d.slots.length} times` : ", no times"}`;
            return (
              <li key={d.date} className="shrink-0">
                <Link
                  prefetch={false}
                  href={bookHref(slug, { ...withStaff, from: fromParam, date: d.date })}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={label}
                  className="pressable flex w-12 flex-col items-center gap-1 py-1 text-center"
                >
                  <span
                    className={`text-caption font-semibold uppercase ${open ? "text-ink-muted" : "text-ink-muted/50"}`}
                  >
                    {pill.weekday}
                  </span>
                  <span
                    className={`flex size-11 items-center justify-center rounded-full text-title font-semibold tabular-nums transition-colors ${
                      isSelected
                        ? "bg-primary text-on-primary"
                        : isToday
                          ? "text-primary"
                          : open
                            ? "text-ink hover:bg-fill"
                            : "text-ink-muted/50"
                    }`}
                  >
                    {pill.day}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${open && !isSelected ? "bg-primary" : "bg-transparent"}`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
        <CenterSelected listId="day-strip" />
      </nav>

      {selected ? (
        <section aria-labelledby="times-heading" className="sheet-up">
          <h2 id="times-heading" className="mb-3 text-heading font-semibold">
            {formatLocalDate(selected.date)}
          </h2>
          {selected.slots.length === 0 ? (
            <div className="rounded-card bg-card p-4 lift">
              <p className="text-body">
                No times on {dayPill(selected.date).weekday}.
                {nextOpen
                  ? ` Next available: ${formatLocalDateShort(nextOpen.date)}, ${formatTime(nextOpen.slots[0].start, setup.timezone)}.`
                  : " Try later dates."}
              </p>
              {nextOpen ? (
                <Link
                  href={bookHref(slug, { ...withStaff, from: fromParam, date: nextOpen.date })}
                  className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-fill font-semibold text-primary hover:bg-ink/10"
                >
                  Show {formatLocalDateShort(nextOpen.date)}
                </Link>
              ) : null}
            </div>
          ) : (
            groupByPartOfDay(selected.slots, setup.timezone).map(([part, slots]) => (
              <div key={part} className="mb-5">
                <h3 className="sticky-head-top -mx-5 mb-2 px-5 pb-2 text-small font-medium text-ink-muted">{part}</h3>
                <ul className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <li key={slot.start.toISOString()}>
                      <Link
                        prefetch={false}
                        href={bookHref(slug, {
                          ...withStaff,
                          from: fromParam,
                          date: selected.date,
                          time: slot.start.toISOString(),
                        })}
                        className="flex min-h-11 items-center justify-center pressable rounded-full bg-fill text-body font-medium tabular-nums text-ink transition-colors hover:bg-primary-soft hover:text-primary active:bg-primary active:text-on-primary"
                      >
                        {formatTime(slot.start, setup.timezone)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : null}
      <p className="text-small text-ink-muted">Times are in {business.name}&apos;s local time.</p>
      <BookingBar summary={summary()} />
    </Shell>
  );
}

function Shell({
  business,
  title,
  back,
  step,
  children,
}: {
  business: BusinessView;
  title: string;
  back?: string;
  step?: { step: number; of: number };
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-2 flex items-center justify-between gap-3 text-small">
        <Link
          href={back ?? `/business/${business.slug}`}
          className="-ml-1 inline-flex min-h-11 items-center gap-0.5 font-medium text-primary"
        >
          <ChevronLeftIcon /> Back
        </Link>
        <Link href={`/business/${business.slug}`} className="min-h-11 content-center truncate text-ink-muted">
          {business.name}
        </Link>
      </div>
      {step ? <StepIndicator step={step.step} of={step.of} /> : null}
      <h1 className="mb-4 text-display font-bold">{title}</h1>
      {children}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <p className="mb-4 rounded-card bg-card p-4 text-body text-ink-muted lift">{children}</p>;
}

function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-12 items-center justify-center font-medium text-primary">
      {children}
    </Link>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-body">
      <dt className="w-20 shrink-0 text-small leading-6 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
