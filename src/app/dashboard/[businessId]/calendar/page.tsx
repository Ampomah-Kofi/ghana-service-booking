import type { Metadata } from "next";
import { Toast } from "@/components/ui/toast";
import Link from "next/link";
import { Fab } from "@/components/ui/fab";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";
import { AppointmentListRow } from "@/components/calendar/appointment-list-row";
import { MonthGrid } from "@/components/calendar/month-grid";
import { Timeline, type TimelineColumn } from "@/components/calendar/timeline";
import { addDays, localDateOf } from "@/lib/availability";
import { addMonths, minuteOfDay, monthGrid, visibleWindow, weekOf } from "@/lib/calendar-layout";
import { dayPill, formatLocalDate, formatLocalDateShort } from "@/lib/datetime";
import { localDateSchema } from "@/schemas/booking";
import { memberBusinessOr404 } from "@/server/businesses/access";
import type { AppointmentStatus } from "@/server/bookings/appointments";
import { getCalendarRange } from "@/server/bookings/calendar";

export const metadata: Metadata = { title: "Calendar" };

type View = "day" | "week" | "month";

/** Provider calendar (SPEC §8): day (a column per person), week, and month views. */
export default async function CalendarPage({ params, searchParams }: PageProps<"/dashboard/[businessId]/calendar">) {
  const { businessId } = await params;
  const sp = await searchParams;
  const member = await memberBusinessOr404(businessId);
  const { business, canManage, ownStaffId } = member;
  const tz = business.timezone;
  const base = `/dashboard/${business.id}`;
  const today = localDateOf(new Date(), tz);
  const view: View = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const date = typeof sp.date === "string" && localDateSchema.safeParse(sp.date).success ? sp.date : today;
  const staffFilter = typeof sp.staff === "string" && /^[0-9a-f-]{36}$/.test(sp.staff) ? sp.staff : null;

  const href = (q: { view?: View; date?: string; staff?: string | null }) => {
    const p = new URLSearchParams();
    const v = q.view ?? view;
    if (v !== "day") p.set("view", v);
    const d = q.date ?? date;
    if (d !== today) p.set("date", d);
    const s = q.staff === undefined ? staffFilter : q.staff;
    if (s) p.set("staff", s);
    const qs = p.toString();
    return `${base}/calendar${qs ? `?${qs}` : ""}`;
  };
  const appointmentHref = (a: { id: string }) => `${base}/appointments/${a.id}`;
  const canAddFor = (staffId: string) => canManage || staffId === ownStaffId;
  const addHref = (staffId: string, d: string) => (time: string) =>
    `${base}/appointments/new?staff=${staffId}&date=${d}&time=${time}`;

  const range =
    view === "day"
      ? { from: date, days: 1 }
      : view === "week"
        ? { from: weekOf(date)[0], days: 7 }
        : { from: monthGrid(date)[0].date, days: 42 };
  const cal = await getCalendarRange(member, { ...range, staffId: staffFilter });
  const team = cal.team;

  const step = view === "day" ? 1 : 7;
  const prev = view === "month" ? addMonths(date, -1) : addDays(date, -step);
  const next = view === "month" ? addMonths(date, 1) : addDays(date, step);
  const title =
    view === "day"
      ? formatLocalDateShort(date)
      : view === "week"
        ? weekTitle(cal.dates[0], cal.dates[6])
        : new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
            new Date(`${date}T12:00:00Z`),
          );

  // Timeline columns
  let columns: TimelineColumn[] = [];
  if (view === "day") {
    columns = cal.staff.map((s) => ({
      key: s.id,
      date,
      title: s.displayName,
      subtitle: s.roleTitle ?? undefined,
      working: cal.working.get(`${s.id}|${date}`) ?? [],
      appointments: cal.appointments.filter((a) => a.staffId === s.id),
      blocks: cal.blocks.filter((b) => b.staffId === null || b.staffId === s.id),
      addHref: canAddFor(s.id) ? addHref(s.id, date) : null,
    }));
  } else if (view === "week") {
    const single = cal.staff.length === 1 ? cal.staff[0] : null;
    columns = cal.dates.map((d) => {
      const pill = dayPill(d);
      return {
        key: d,
        date: d,
        title: `${pill.weekday} ${pill.day}`,
        highlight: d === today,
        // Working time for the week view: when anyone works (union), so the grid dims fully closed time.
        working: cal.staff.flatMap((s) => cal.working.get(`${s.id}|${d}`) ?? []),
        appointments: cal.appointments.filter((a) => localDateOf(new Date(a.startsAt), tz) === d),
        blocks: single
          ? cal.blocks.filter((b) => b.staffId === null || b.staffId === single.id)
          : cal.blocks.filter((b) => b.staffId === null),
        addHref: single && canAddFor(single.id) ? addHref(single.id, d) : null,
      };
    });
  }
  const window = visibleWindow(
    columns.flatMap((c) => c.working),
    columns.flatMap((c) =>
      c.appointments.map((a) => ({
        from: minuteOfDay(new Date(a.startsAt), c.date, tz),
        to: minuteOfDay(new Date(a.endsAt), c.date, tz),
      })),
    ),
  );

  const byDate = new Map<string, AppointmentStatus[]>();
  if (view === "month") {
    for (const a of cal.appointments) {
      const d = localDateOf(new Date(a.startsAt), tz);
      byDate.set(d, [...(byDate.get(d) ?? []), a.status]);
    }
  }
  const dayCount = view === "day" ? cal.appointments.length : 0;

  return (
    <>
      {typeof sp.added === "string" ? <Toast message="Appointment added" /> : null}

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-display font-bold">{title}</h1>
          {view === "day" ? (
            <p className="text-small text-ink-muted">
              {dayCount === 0 ? "Nothing booked" : `${dayCount} appointment${dayCount === 1 ? "" : "s"}`}
              {date === today ? " · Today" : ""}
            </p>
          ) : null}
        </div>
        <Segmented
          label="Calendar view"
          items={(["day", "week", "month"] as const).map((v) => ({
            href: href({ view: v }),
            label: v[0].toUpperCase() + v.slice(1),
            active: v === view,
          }))}
        />
      </header>

      <div className="mb-4 flex items-center gap-2">
        <Link
          href={href({ date: prev })}
          aria-label={`Previous ${view}`}
          className="flex size-11 items-center justify-center rounded-full bg-fill hover:bg-ink/10"
        >
          <ChevronLeftIcon />
        </Link>
        <Link
          href={href({ date: today })}
          aria-current={date === today ? "date" : undefined}
          className="flex min-h-11 items-center rounded-full bg-fill px-4 text-small font-semibold hover:bg-ink/10"
        >
          Today
        </Link>
        <Link
          href={href({ date: next })}
          aria-label={`Next ${view}`}
          className="flex size-11 items-center justify-center rounded-full bg-fill hover:bg-ink/10"
        >
          <ChevronRightIcon />
        </Link>
      </div>

      {view === "day" ? (
        <ul className="mb-4 grid grid-cols-7 gap-1" aria-label="This week">
          {weekOf(date).map((d) => {
            const pill = dayPill(d);
            const active = d === date;
            return (
              <li key={d}>
                <Link
                  href={href({ date: d })}
                  aria-label={formatLocalDate(d)}
                  aria-current={active ? "date" : undefined}
                  className={`flex flex-col items-center rounded-control py-1.5 text-caption ${
                    active
                      ? "bg-primary text-on-primary"
                      : d === today
                        ? "text-primary"
                        : "text-ink-muted hover:bg-fill"
                  }`}
                >
                  <span>{pill.weekday}</span>
                  <span className="text-heading font-semibold tabular-nums">{pill.day}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {canManage && team.length > 1 ? (
        <nav aria-label="Team member" className="-mx-5 mb-4 overflow-x-auto px-5 [scrollbar-width:none]">
          <ul className="flex w-max gap-2">
            {[{ id: null, displayName: "Everyone" }, ...team].map((s) => {
              const active = staffFilter === s.id;
              return (
                <li key={s.id ?? "all"}>
                  <Link
                    href={href({ staff: s.id })}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-9 items-center rounded-full border px-3.5 text-small font-medium ${
                      active
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-ink hover:bg-fill"
                    }`}
                  >
                    {s.displayName}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {view === "month" ? (
        <MonthGrid date={date} today={today} byDate={byDate} dayHref={(d) => href({ view: "day", date: d })} />
      ) : columns.length === 0 ? (
        <p className="rounded-card bg-card p-5 text-body text-ink-muted lift">
          No one takes appointments yet.{" "}
          {canManage ? (
            <Link href={`${base}/team`} className="font-medium text-primary">
              Set up your team
            </Link>
          ) : null}
        </p>
      ) : view === "week" ? (
        <>
          <div className="md:hidden">
            <WeekAgenda columns={columns} timezone={tz} base={base} showStaff={canManage && cal.staff.length > 1} />
          </div>
          <div className="hidden md:block">
            <Timeline
              columns={columns}
              window={window}
              timezone={tz}
              hrefFor={appointmentHref}
              minColumnWidth="6.5rem"
            />
          </div>
        </>
      ) : (
        <Timeline
          columns={columns}
          window={window}
          timezone={tz}
          hrefFor={appointmentHref}
          minColumnWidth={columns.length === 1 ? "0px" : "10rem"}
        />
      )}
      {view === "week" && cal.staff.length > 1 ? (
        <p className="mt-2 hidden text-small text-ink-muted md:block">
          Showing everyone. Pick a team member above to add by tapping.
        </p>
      ) : null}

      <Fab
        items={[
          { href: `${base}/appointments/new?walkIn=1`, label: "Walk-in", hint: "Someone is here now" },
          {
            href: `${base}/appointments/new?date=${date}`,
            label: "New appointment",
            hint: "Phone or in-person booking",
          },
          ...(canManage ? [{ href: `${base}/time-off`, label: "Block time", hint: "Breaks, days off" }] : []),
        ]}
      />
    </>
  );
}

function weekTitle(from: string, to: string): string {
  const a = dayPill(from);
  const b = dayPill(to);
  return a.month === b.month ? `${a.day} – ${b.day} ${b.month}` : `${a.day} ${a.month} – ${b.day} ${b.month}`;
}

/** Week on a phone: a list per day (a 7-column timeline is too cramped at 360 px). */
function WeekAgenda({
  columns,
  timezone,
  base,
  showStaff,
}: {
  columns: TimelineColumn[];
  timezone: string;
  base: string;
  showStaff: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {columns.map((c) => (
        <section key={c.key} aria-label={formatLocalDate(c.date)}>
          <h2 className={`mb-1.5 text-small font-semibold ${c.highlight ? "text-primary" : "text-ink-muted"}`}>
            {formatLocalDateShort(c.date)}
            {c.highlight ? " · Today" : ""}
          </h2>
          {c.appointments.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-4 py-3 text-small text-ink-muted">
              {c.working.length === 0 ? "Closed" : "Nothing booked"}
            </p>
          ) : (
            <ul className="ios-list overflow-hidden rounded-card bg-card lift">
              {c.appointments.map((a) => (
                <AppointmentListRow
                  key={a.id}
                  appointment={a}
                  href={`${base}/appointments/${a.id}`}
                  timezone={timezone}
                  showStaff={showStaff}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
