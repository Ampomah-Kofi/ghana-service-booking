import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cache } from "react";
import { formatDuration } from "@/lib/hours";
import { formatMoney } from "@/lib/money";
import { dayPill, formatDayLong, formatLocalDate, formatTime } from "@/lib/datetime";
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
    return (
      <Shell business={business} title="Choose a service">
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
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-card border border-border">
            {setup.services.map((s) => (
              <li key={s.id}>
                <Link
                  href={bookHref(slug, { service: s.id })}
                  className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 hover:bg-fill"
                >
                  <span className="min-w-0">
                    <span className="block text-body font-medium">{s.name}</span>
                    <span className="block text-small text-ink-muted">{formatDuration(s.durationMinutes)}</span>
                  </span>
                  <span className="shrink-0 text-body font-semibold tabular-nums">
                    {s.priceType === "from" ? <span className="text-small font-normal">from </span> : null}
                    {money(s.priceMinor)}{" "}
                    <span aria-hidden="true" className="text-ink-muted">
                      ›
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Shell>
    );
  }

  const eligible = staffForService(setup, service.id);
  const chosen = eligible.find((s) => s.id === query.staff) ?? null;
  const staffChoice = chosen ? chosen.id : "any";
  const withWhom = chosen?.displayName ?? (eligible.length === 1 ? eligible[0].displayName : "Any available");
  const summary = (
    <p className="mb-5 inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-full bg-card px-4 py-2 text-small border border-border">
      <span className="font-semibold">{service.name}</span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">
        {service.priceType === "from" ? "from " : ""}
        {money(service.priceMinor)}
      </span>
      <span aria-hidden="true">·</span>
      <span>{formatDuration(service.durationMinutes)}</span>
      {business.kind === "team" ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{withWhom}</span>
        </>
      ) : null}
    </p>
  );
  const base: Query = { service: reschedule ? undefined : service.id, reschedule: reschedule?.id };

  // ── Step 2: who (team businesses only; solo providers never see this) ──────
  if (eligible.length > 1 && !query.staff) {
    return (
      <Shell business={business} title="Choose a professional" back={reschedule ? "/bookings" : bookHref(slug, {})}>
        {summary}
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-card border border-border">
          {[
            { id: "any", displayName: "Any available professional", roleTitle: "We'll match you with whoever is free" },
            ...eligible,
          ].map((s) => (
            <li key={s.id}>
              <Link
                href={bookHref(slug, { ...base, staff: s.id })}
                className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-fill"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-body font-semibold text-ink-muted"
                >
                  {s.id === "any" ? "✦" : s.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium">{s.displayName}</span>
                  {s.roleTitle ? <span className="block text-small text-ink-muted">{s.roleTitle}</span> : null}
                </span>
                <span aria-hidden="true" className="text-ink-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  const withStaff: Query = { ...base, staff: chosen ? chosen.id : eligible.length > 1 ? "any" : undefined };
  const today = todayIn(setup.timezone);
  const lastDate = lastBookableDate(setup);
  const timeStepBack = eligible.length > 1 ? bookHref(slug, base) : reschedule ? "/bookings" : bookHref(slug, {});

  // ── Step 4: confirm ─────────────────────────────────────────────────────────
  const startsAt = query.time ? new Date(query.time) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime())) {
    const candidates = await candidatesFor(db, setup, { serviceId: service.id, staffId: chosen?.id ?? null, startsAt });
    const timeHref = bookHref(slug, { ...withStaff, date: query.date, from: query.from });
    if (candidates.length === 0) {
      return (
        <Shell business={business} title="That time is no longer free" back={timeHref}>
          {summary}
          <Panel>Someone may have just booked it. Please choose another time.</Panel>
          <BackLink href={timeHref}>Choose another time</BackLink>
        </Shell>
      );
    }
    const when = `${formatDayLong(startsAt, setup.timezone)} at ${formatTime(startsAt, setup.timezone)}`;
    const place = formatPlace(business.location);
    const details = (
      <dl className="mb-5 divide-y divide-border overflow-hidden rounded-card bg-card border border-border">
        <Row label="When">{when}</Row>
        <Row label="Service">
          {service.name} · {formatDuration(service.durationMinutes)}
        </Row>
        {business.kind === "team" ? <Row label="With">{withWhom}</Row> : null}
        <Row label="Price">
          {service.priceType === "from" ? "from " : ""}
          {money(service.priceMinor)}
          {service.priceType === "from" ? " (final price at the appointment)" : ""}
        </Row>
        {service.depositMinor ? (
          <Row label="Deposit">{money(service.depositMinor)}, the business will tell you how to pay it</Row>
        ) : null}
        {place ? <Row label="Where">{place}</Row> : null}
      </dl>
    );

    if (reschedule) {
      return (
        <Shell business={business} title="Move your booking?" back={timeHref}>
          <p className="mb-4 text-body text-ink-muted">
            From {formatDayLong(reschedule.startsAt, setup.timezone)} at{" "}
            {formatTime(reschedule.startsAt, setup.timezone)}
          </p>
          {details}
          <ConfirmRescheduleForm appointmentId={reschedule.id} staff={staffChoice} startsAt={startsAt.toISOString()} />
        </Shell>
      );
    }

    if (!user) {
      const next = bookHref(slug, { ...withStaff, date: query.date, time: startsAt.toISOString() });
      return (
        <Shell business={business} title="Almost done" back={timeHref}>
          {details}
          <Panel>
            Sign in with your phone number to confirm. It takes a minute, and you can manage the booking later.
          </Panel>
          <Link
            href={`/sign-in?next=${encodeURIComponent(next)}`}
            className="flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 text-body font-semibold text-on-primary"
          >
            Sign in to book
          </Link>
        </Shell>
      );
    }

    const profile = await getMyProfile();
    return (
      <Shell business={business} title="Your details" back={timeHref}>
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
        />
        <p className="mt-3 text-center text-small text-ink-muted">
          {setup.rules.autoConfirm
            ? "Your booking is confirmed straight away."
            : `${business.name} will confirm your booking.`}{" "}
          {setup.rules.cancellationWindowHours > 0
            ? `You can cancel or move it online up to ${setup.rules.cancellationWindowHours} hours before.`
            : "You can cancel or move it online any time before it starts."}
        </p>
      </Shell>
    );
  }

  // ── Step 3: date and time ───────────────────────────────────────────────────
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
  const earlier = from > today ? (addDays(from, -DAYS_PER_PAGE) < today ? today : addDays(from, -DAYS_PER_PAGE)) : null;
  const later = addDays(from, DAYS_PER_PAGE) <= lastDate ? addDays(from, DAYS_PER_PAGE) : null;

  return (
    <Shell business={business} title={reschedule ? "Choose a new time" : "Choose a time"} back={timeStepBack}>
      {summary}
      <nav aria-label="Dates" className="mb-5">
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {days.map((d) => {
            const pill = dayPill(d.date);
            const isSelected = d.date === selected?.date;
            const open = d.slots.length > 0;
            const label = `${formatLocalDate(d.date)}${open ? `, ${d.slots.length} times` : ", fully booked or closed"}`;
            return (
              <li key={d.date} className="shrink-0">
                <Link
                  href={bookHref(slug, { ...withStaff, from: from === today ? undefined : from, date: d.date })}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={label}
                  className={`flex w-14 flex-col items-center rounded-card py-2 text-center ${
                    isSelected
                      ? "bg-primary text-on-primary"
                      : open
                        ? "bg-card border border-border"
                        : "bg-fill text-ink-muted line-through decoration-1"
                  }`}
                >
                  <span className="text-small">{d.date === today ? "Today" : pill.weekday}</span>
                  <span className="text-title font-semibold tabular-nums">{pill.day}</span>
                  <span className="text-small">{pill.month}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-between text-small">
          {earlier ? (
            <Link
              href={bookHref(slug, { ...withStaff, from: earlier === today ? undefined : earlier })}
              className="min-h-11 content-center font-medium text-primary"
            >
              ‹ Earlier
            </Link>
          ) : (
            <span />
          )}
          {later ? (
            <Link
              href={bookHref(slug, { ...withStaff, from: later })}
              className="min-h-11 content-center font-medium text-primary"
            >
              Later dates ›
            </Link>
          ) : null}
        </div>
      </nav>

      {selected ? (
        <section aria-labelledby="times-heading">
          <h2 id="times-heading" className="mb-3 text-title font-semibold">
            {formatLocalDate(selected.date)}
          </h2>
          {selected.slots.length === 0 ? (
            <Panel>
              No free times on this day.{" "}
              {days.some((d) => d.slots.length > 0) ? "Try another day above." : "Try later dates."}
            </Panel>
          ) : (
            groupByPartOfDay(selected.slots, setup.timezone).map(([part, slots]) => (
              <div key={part} className="mb-5">
                <h3 className="mb-2 text-heading font-semibold text-ink">{part}</h3>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                  {slots.map((slot) => (
                    <li key={slot.start.toISOString()}>
                      <Link
                        href={bookHref(slug, {
                          ...withStaff,
                          from: from === today ? undefined : from,
                          date: selected.date,
                          time: slot.start.toISOString(),
                        })}
                        className="flex min-h-11 items-center justify-center rounded-full bg-card text-body font-medium tabular-nums text-primary border border-border hover:bg-fill"
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
      <p className="text-small text-ink-muted">Times are shown in {business.name}&apos;s local time.</p>
    </Shell>
  );
}

function Shell({
  business,
  title,
  back,
  children,
}: {
  business: BusinessView;
  title: string;
  back?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-small">
        <Link href={back ?? `/business/${business.slug}`} className="min-h-11 content-center font-medium text-primary">
          ‹ Back
        </Link>
        <Link href={`/business/${business.slug}`} className="min-h-11 content-center truncate text-ink-muted">
          {business.name}
        </Link>
      </div>
      <h1 className="mb-4 text-display font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <p className="mb-4 rounded-card bg-card p-4 text-body text-ink-muted border border-border">{children}</p>;
}

function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-11 items-center justify-center font-medium text-primary">
      {children}
    </Link>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-body">
      <dt className="w-20 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
