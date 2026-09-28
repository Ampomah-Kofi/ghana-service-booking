import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cache } from "react";
import { BookingBar, StepIndicator, type BookingSummary } from "@/components/booking/booking-bar";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { formatDuration } from "@/lib/hours";
import { formatMoney, formatPrice } from "@/lib/money";
import { dayPill, formatDateShort, formatLocalDate, formatLocalDateShort, formatTime } from "@/lib/datetime";
import { addDays, groupByPartOfDay } from "@/lib/availability";
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
  const money = (amountMinor: number) =>
    formatMoney({ amountMinor, currency: business.currency.code }, business.currency);

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
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
            {setup.services.map((s) => (
              <li key={s.id}>
                <Link
                  href={bookHref(slug, { service: s.id })}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-fill active:bg-fill"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium">{s.name}</span>
                    <span className="block text-small text-ink-muted">{formatDuration(s.durationMinutes)}</span>
                    {s.depositMinor ? (
                      <span className="block text-small text-warning">{money(s.depositMinor)} deposit to book</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-heading font-semibold tabular-nums">
                    {formatPrice(s.priceMinor, s.priceType, business.currency)}
                  </span>
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
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
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
      <dl className="mb-5 divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
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
          ) : null}
        </Row>
        {service.depositMinor ? (
          <Row label="Deposit">
            <span className="tabular-nums">{money(service.depositMinor)}</span>
            <span className="block text-small text-ink-muted">The business will tell you how to pay it</span>
          </Row>
        ) : null}
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
              className="flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-4 text-body font-semibold text-on-primary hover:bg-primary-hover"
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
  const earlier = from > today ? (addDays(from, -DAYS_PER_PAGE) < today ? today : addDays(from, -DAYS_PER_PAGE)) : null;
  const later = addDays(from, DAYS_PER_PAGE) <= lastDate ? addDays(from, DAYS_PER_PAGE) : null;
  const fromParam = from === today ? undefined : from;

  return (
    <Shell
      business={business}
      title={reschedule ? "Choose a new time" : "Choose a time"}
      back={timeStepBack}
      step={{ step: totalSteps - 1, of: totalSteps }}
    >
      <nav aria-label="Dates" className="mb-4">
        <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {days.map((d) => {
            const pill = dayPill(d.date);
            const isSelected = d.date === selected?.date;
            const open = d.slots.length > 0;
            const label = `${formatLocalDate(d.date)}${open ? `, ${d.slots.length} times` : ", no times"}`;
            return (
              <li key={d.date} className="shrink-0 snap-start">
                <Link
                  prefetch={false}
                  href={bookHref(slug, { ...withStaff, from: fromParam, date: d.date })}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={label}
                  className={`flex w-14 flex-col items-center rounded-card border py-2 text-center transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-on-primary"
                      : open
                        ? "border-border bg-card hover:bg-fill"
                        : "border-transparent text-ink-muted"
                  }`}
                >
                  <span className="text-caption">{d.date === today ? "Today" : pill.weekday}</span>
                  <span className="text-title font-semibold tabular-nums">{pill.day}</span>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 size-1.5 rounded-full ${open && !isSelected ? "bg-primary" : "bg-transparent"}`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-between text-small">
          {earlier ? (
            <Link
              href={bookHref(slug, { ...withStaff, from: earlier === today ? undefined : earlier })}
              className="inline-flex min-h-11 items-center gap-1 font-medium text-primary"
            >
              <ChevronLeftIcon /> Earlier
            </Link>
          ) : (
            <span />
          )}
          {later ? (
            <Link
              href={bookHref(slug, { ...withStaff, from: later })}
              className="inline-flex min-h-11 items-center gap-1 font-medium text-primary"
            >
              Later dates <ChevronRightIcon />
            </Link>
          ) : null}
        </div>
      </nav>

      {selected ? (
        <section aria-labelledby="times-heading" className="sheet-up">
          <h2 id="times-heading" className="mb-3 text-title font-semibold">
            {formatLocalDate(selected.date)}
          </h2>
          {selected.slots.length === 0 ? (
            <div className="rounded-card border border-border bg-card p-4">
              <p className="text-body">
                No times on {dayPill(selected.date).weekday}.
                {nextOpen
                  ? ` Next available: ${formatLocalDateShort(nextOpen.date)}, ${formatTime(nextOpen.slots[0].start, setup.timezone)}.`
                  : " Try later dates."}
              </p>
              {nextOpen ? (
                <Link
                  href={bookHref(slug, { ...withStaff, from: fromParam, date: nextOpen.date })}
                  className="mt-3 flex min-h-12 items-center justify-center rounded-control border border-border bg-card font-semibold text-primary hover:bg-fill"
                >
                  Show {formatLocalDateShort(nextOpen.date)}
                </Link>
              ) : null}
            </div>
          ) : (
            groupByPartOfDay(selected.slots, setup.timezone).map(([part, slots]) => (
              <div key={part} className="mb-5">
                <h3 className="mb-2 text-small font-medium text-ink-muted">{part}</h3>
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
                        className="flex min-h-12 items-center justify-center rounded-control border border-border bg-card text-body font-medium tabular-nums text-primary transition-colors hover:border-primary hover:bg-primary-soft active:bg-primary active:text-on-primary"
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
      <h1 className="mb-4 text-display font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <p className="mb-4 rounded-card border border-border bg-card p-4 text-body text-ink-muted">{children}</p>;
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
