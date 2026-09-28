import type { Metadata } from "next";
import { Countdown } from "./countdown";
import { countdownLabel } from "@/lib/countdown";
import { EmptyState } from "@/components/ui/empty-state";
import { SunIcon } from "@/components/ui/icons";
import { LargeTitle } from "@/components/ui/large-title";
import Link from "next/link";
import type { ReactNode } from "react";
import { SourceBadge, STATUS, StatusBadge } from "@/components/bookings/status-badge";
import { AppointmentListRow } from "@/components/calendar/appointment-list-row";
import { Fab } from "@/components/ui/fab";
import { ChatIcon, ChevronRightIcon, PhoneIcon } from "@/components/ui/icons";
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
  const summary = await getTodaySummary(member);
  const tz = business.timezone;
  const base = `/dashboard/${business.id}`;
  const money = (minor: number) =>
    formatMoney({ amountMinor: minor, currency: summary.currency.code }, summary.currency);
  const now = new Date();
  const next = summary.next;
  const showStaff = canManage && business.kind === "team";

  return (
    <>
      <LargeTitle title="Today" eyebrow={formatLocalDateShort(summary.date)} />

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
        <section aria-labelledby="next-heading" className="mb-5 overflow-hidden rounded-card bg-card lift">
          <div className={`h-1.5 ${STATUS[next.status].bar}`} aria-hidden="true" />
          <div className="p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="next-heading" className="text-small font-semibold text-primary" aria-live="polite">
                <Countdown at={next.startsAt} initial={countdownLabel(new Date(next.startsAt), now)} />
              </h2>
              <span className="flex gap-1.5">
                <SourceBadge source={next.source} />
                <StatusBadge status={next.status} />
              </span>
            </div>
            <Link href={`${base}/appointments/${next.id}`} className="block">
              <p className="text-display font-bold tabular-nums">{formatTime(next.startsAt, tz)}</p>
              <p className="text-heading font-semibold">{next.customerName}</p>
              <p className="text-small text-ink-muted">
                {next.serviceName}
                {showStaff && next.staffName ? ` · ${next.staffName}` : ""} · until {formatTime(next.endsAt, tz)}
              </p>
            </Link>
            <div className="mt-4 flex gap-2">
              {nextStatuses(next.status, new Date(next.startsAt), now)
                .filter((s) => s === "arrived" || s === "completed" || s === "confirmed")
                .slice(0, 1)
                .map((status) => (
                  <StatusButton key={status} businessId={business.id} appointmentId={next.id} status={status} />
                ))}
              {next.customerPhone ? (
                <>
                  <IconLink href={telUrl(next.customerPhone)} label={`Call ${next.customerName}`}>
                    <PhoneIcon />
                  </IconLink>
                  <IconLink href={whatsappChatUrl(next.customerPhone)} label={`WhatsApp ${next.customerName}`} external>
                    <ChatIcon className="text-whatsapp" />
                  </IconLink>
                </>
              ) : null}
            </div>
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
        <div className="mb-2 flex items-baseline justify-between">
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
          <div className="mb-2 flex items-baseline justify-between">
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
    <div className="rounded-card bg-card p-4 lift">
      <p className="text-small text-ink-muted">{label}</p>
      <p className="truncate text-title font-semibold tabular-nums">{value}</p>
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
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-fill hover:bg-ink/10"
    >
      {children}
    </a>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}
