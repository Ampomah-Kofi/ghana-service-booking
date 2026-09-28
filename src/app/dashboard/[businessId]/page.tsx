import type { Metadata } from "next";
import { listReviewsForBusiness } from "@/server/reviews/reviews";
import { LiveHeading, LivePill, LiveProgress } from "./countdown";
import { EmptyState } from "@/components/ui/empty-state";
import { SunIcon } from "@/components/ui/icons";
import { LargeTitle } from "@/components/ui/large-title";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppointmentListRow } from "@/components/calendar/appointment-list-row";
import { Fab } from "@/components/ui/fab";
import { ChatIcon, ChevronRightIcon, PhoneIcon, StarIcon } from "@/components/ui/icons";
import { formatLocalDateShort, formatTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { telUrl, whatsappChatUrl } from "@/lib/share";
import { memberBusinessOr404 } from "@/server/businesses/access";
import { nextStatuses } from "@/server/bookings/manage";
import { getTodaySummary } from "@/server/bookings/today";
import { StatusButton } from "./status-form";

export const metadata: Metadata = { title: "Today" };

/** Provider home (SPEC §8): what's next, today's numbers, today's list, recent clients. */
export default async function TodayPage({ params }: PageProps<"/dashboard/[businessId]">) {
  const { businessId } = await params;
  const member = await memberBusinessOr404(businessId);
  const { business, canManage } = member;
  const [summary, unanswered] = await Promise.all([
    getTodaySummary(member),
    member.canManage ? listReviewsForBusiness(member.db, member.business.id, { filter: "unanswered", limit: 20 }) : [],
  ]);
  const tz = business.timezone;
  const base = `/dashboard/${business.id}`;
  const money = (minor: number) =>
    formatMoney({ amountMinor: minor, currency: summary.currency.code }, summary.currency);
  const now = new Date();
  const next = summary.next;
  // One main action on the live card: confirm, arrived, or complete, whichever is possible now.
  const nextAction = next
    ? (nextStatuses(next.status, new Date(next.startsAt), now).find(
        (s) => s === "arrived" || s === "completed" || s === "confirmed",
      ) ?? null)
    : null;
  const showStaff = canManage && business.kind === "team";

  return (
    <>
      <LargeTitle title="Today" eyebrow={formatLocalDateShort(summary.date)} />

      {unanswered.length > 0 ? (
        <Link
          href={`${base}/reviews?show=unanswered`}
          className="pressable mb-5 flex items-center gap-3 rounded-card bg-card p-4 lift"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-star/15 text-star">
            <StarIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">
              {unanswered.length === 1 ? "1 new review" : `${unanswered.length} new reviews`}
            </span>
            <span className="block truncate text-small text-ink-muted">A quick reply shows customers you care.</span>
          </span>
          <ChevronRightIcon className="shrink-0 text-ink-muted" />
        </Link>
      ) : null}

      {canManage && business.status === "draft" ? (
        <Link
          href={`${base}/more`}
          className="mb-5 flex items-center gap-3 rounded-card border border-warning/30 bg-warning/8 p-4"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">Finish your page to take online bookings</span>
            <span className="block text-small text-ink-muted">You can already add walk-ins and phone bookings.</span>
          </span>
          <ChevronRightIcon className="shrink-0 text-ink-muted" />
        </Link>
      ) : null}

      {next ? (
        <section aria-labelledby="next-heading" className="live-card mb-5 overflow-hidden rounded-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="next-heading" className="text-caption font-semibold tracking-wider uppercase opacity-90">
              <LiveHeading start={next.startsAt} renderedAt={now.toISOString()} />
            </h2>
            <LivePill start={next.startsAt} end={next.endsAt} renderedAt={now.toISOString()} />
          </div>

          <Link href={`${base}/appointments/${next.id}`} className="pressable group block">
            <p className="text-display leading-none font-bold tabular-nums">
              {formatTime(next.startsAt, tz)}
              <span className="ml-2 text-heading font-medium tabular-nums opacity-70">
                – {formatTime(next.endsAt, tz)}
              </span>
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-title font-bold backdrop-blur-md"
              >
                {next.customerName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-title font-semibold">{next.customerName}</span>
                <span className="block truncate text-small opacity-80">
                  {next.serviceName}
                  {showStaff && next.staffName ? ` · with ${next.staffName}` : ""}
                </span>
              </span>
              <ChevronRightIcon className="shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          {next.source === "walk_in" || next.status === "pending" ? (
            <p className="mt-3 flex gap-1.5">
              {next.source === "walk_in" ? (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-caption font-semibold">Walk-in</span>
              ) : null}
              {next.status === "pending" ? (
                <span className="rounded-full bg-amber-300/25 px-2.5 py-0.5 text-caption font-semibold">
                  Waiting for you to confirm
                </span>
              ) : null}
            </p>
          ) : null}

          <LiveProgress start={next.startsAt} end={next.endsAt} renderedAt={now.toISOString()} />

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {nextAction === null ? (
              <Link
                href={`${base}/appointments/${next.id}`}
                className="pressable flex min-h-12 flex-1 items-center justify-center rounded-full bg-white/15 font-semibold backdrop-blur-md hover:bg-white/25"
              >
                Details
              </Link>
            ) : null}
            {[nextAction]
              .filter((s) => s !== null)
              .map((status) => (
                <StatusButton
                  key={status}
                  businessId={business.id}
                  appointmentId={next.id}
                  status={status}
                  className="bg-white! text-live-ink! shadow-sm hover:bg-white/90!"
                />
              ))}
            {next.customerPhone ? (
              <>
                <IconLink href={telUrl(next.customerPhone)} label={`Call ${next.customerName}`}>
                  <PhoneIcon />
                </IconLink>
                <IconLink href={whatsappChatUrl(next.customerPhone)} label={`WhatsApp ${next.customerName}`} external>
                  <ChatIcon />
                </IconLink>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-label="Today in numbers" className="mb-5 grid grid-cols-2 gap-2">
        <Stat label="Booked" value={String(summary.counts.booked)} detail={`${summary.counts.toCome} still to come`} />
        {canManage ? (
          <Stat label="Expected" value={money(summary.expectedRevenueMinor)} detail="Today's services" />
        ) : (
          <Stat label="Completed" value={String(summary.counts.completed)} />
        )}
        <Stat label="Walk-ins" value={String(summary.counts.walkIns)} />
        {canManage ? (
          <Stat label="Completed" value={String(summary.counts.completed)} />
        ) : (
          <Stat label="No-shows" value={String(summary.counts.noShows)} />
        )}
      </section>
      {summary.counts.cancelled + summary.counts.noShows > 0 ? (
        <p className="-mt-3 mb-5 px-1 text-small text-ink-muted">
          {summary.counts.cancelled} cancelled · {summary.counts.noShows} no-show
          {summary.counts.noShows === 1 ? "" : "s"}
        </p>
      ) : null}

      <section aria-labelledby="list-heading" className="mb-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="list-heading" className="text-title font-semibold">
            Appointments
          </h2>
          <Link href={`${base}/calendar`} className="text-small font-medium text-primary">
            Open calendar
          </Link>
        </div>
        {summary.appointments.length === 0 ? (
          <EmptyState
            icon={SunIcon}
            title="No appointments today"
            body="Add a walk-in when someone arrives."
            action={{ href: `${base}/appointments/new?walkIn=1`, label: "Add walk-in", primary: true }}
            className="rounded-card bg-card py-8 lift"
          />
        ) : (
          <ul className="ios-list overflow-hidden rounded-card bg-card lift">
            {summary.appointments.map((a) => (
              <AppointmentListRow
                key={a.id}
                appointment={a}
                href={`${base}/appointments/${a.id}`}
                timezone={tz}
                showStaff={showStaff}
              />
            ))}
          </ul>
        )}
      </section>

      {canManage && summary.recentClients.length > 0 ? (
        <section aria-labelledby="clients-heading" className="mb-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 id="clients-heading" className="text-title font-semibold">
              Recent clients
            </h2>
            <Link href={`${base}/clients`} className="text-small font-medium text-primary">
              All clients
            </Link>
          </div>
          <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {summary.recentClients.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link
                  href={`${base}/clients/${c.id}`}
                  className="flex w-24 flex-col items-center gap-1 rounded-card bg-card px-2 py-3 text-center hover:bg-fill lift"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-heading font-semibold text-primary"
                  >
                    {initials(c.name)}
                  </span>
                  <span className="w-full truncate text-small font-medium">{c.name}</span>
                  <span className="text-caption text-ink-muted">
                    {c.visits} visit{c.visits === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Fab
        items={[
          { href: `${base}/appointments/new?walkIn=1`, label: "Walk-in", hint: "Someone is here now" },
          { href: `${base}/appointments/new`, label: "New appointment", hint: "Phone or in-person booking" },
          ...(canManage ? [{ href: `${base}/time-off`, label: "Block time", hint: "Breaks, days off" }] : []),
        ]}
      />
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="@container rounded-card bg-card p-4 lift">
      <p className="text-small text-ink-muted">{label}</p>
      {/* Shrinks with the tile (container units) so "GH₵ 12,500" fits a half-width phone tile uncut. */}
      <p className="truncate text-title font-semibold tabular-nums [font-size:min(1.25rem,14cqi)]">{value}</p>
      {detail ? <p className="truncate text-caption text-ink-muted">{detail}</p> : null}
    </div>
  );
}

function IconLink({
  href,
  label,
  external,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="pressable flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25"
    >
      {children}
    </a>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}
