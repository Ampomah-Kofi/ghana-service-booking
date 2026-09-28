import Link from "next/link";
import { STATUS } from "@/components/bookings/status-badge";
import { formatTime } from "@/lib/datetime";
import { nowLine, placeInColumn, type MinuteRange } from "@/lib/calendar-layout";
import type { AppointmentView } from "@/server/bookings/appointments";
import type { BlockedTimeView } from "@/server/businesses/schedule";

export const PX_PER_MINUTE = 1.2; // 72 px per hour: readable 30-minute blocks on a phone

export type TimelineColumn = {
  key: string;
  date: string;
  title: string;
  subtitle?: string;
  highlight?: boolean;
  working: MinuteRange[];
  appointments: AppointmentView[];
  blocks: BlockedTimeView[];
  /** Tapping empty time adds an appointment here (null when the viewer can't add to this column). */
  addHref: ((time: string) => string) | null;
};

const hourLabel = (minute: number) => {
  const h = Math.floor(minute / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;
};
const clockLabel = (minute: number) => {
  const h = Math.floor(minute / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(minute % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
const hhmm = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/**
 * Calendar timeline (docs/design.md §3a): hour grid, one column per person (day view) or
 * per day (week view), dimmed non-working time, hatched time off, status-toned blocks
 * and a "now" line. Server-rendered; every block and empty half-hour is a plain link.
 */
export function Timeline({
  columns,
  window,
  timezone,
  hrefFor,
  now = new Date(),
  minColumnWidth = "10rem",
}: {
  columns: TimelineColumn[];
  window: MinuteRange;
  timezone: string;
  hrefFor: (appointment: AppointmentView) => string;
  now?: Date;
  minColumnWidth?: string;
}) {
  const height = (window.to - window.from) * PX_PER_MINUTE;
  const hours: number[] = [];
  for (let m = window.from; m < window.to; m += 60) hours.push(m);
  const halfHours: number[] = [];
  for (let m = window.from; m < window.to; m += 30) halfHours.push(m);

  return (
    <div className="-mx-5 overflow-x-auto border-y border-border bg-card md:mx-0 md:rounded-card md:border">
      <div
        className="grid min-w-full"
        style={{ gridTemplateColumns: `3.25rem repeat(${columns.length}, minmax(${minColumnWidth}, 1fr))` }}
      >
        {/* Header row */}
        <div className="sticky left-0 z-20 border-b border-border bg-card" />
        {columns.map((c) => (
          <div key={c.key} className="border-b border-l border-border px-2 py-2 text-center">
            <p className={`truncate text-small font-semibold ${c.highlight ? "text-primary" : ""}`}>{c.title}</p>
            {c.subtitle ? <p className="truncate text-caption text-ink-muted">{c.subtitle}</p> : null}
          </div>
        ))}

        {/* Hour gutter */}
        <div className="sticky left-0 z-20 bg-card" style={{ height }}>
          {hours.map((m) => (
            <span
              key={m}
              className={`absolute right-1.5 text-caption tabular-nums text-ink-muted ${
                m === window.from ? "translate-y-0.5" : "-translate-y-1/2"
              }`}
              style={{ top: (m - window.from) * PX_PER_MINUTE }}
            >
              {hourLabel(m)}
            </span>
          ))}
        </div>

        {columns.map((c) => {
          const items = placeInColumn(
            c.appointments.map((a) => ({ ...a, id: a.id, start: new Date(a.startsAt), end: new Date(a.endsAt) })),
            c.date,
            timezone,
            window,
            PX_PER_MINUTE,
          );
          const blocks = placeInColumn(
            c.blocks.map((b) => ({ ...b, start: new Date(b.startsAt), end: new Date(b.endsAt) })),
            c.date,
            timezone,
            window,
            PX_PER_MINUTE,
          );
          const nowTop = nowLine(now, c.date, timezone, window, PX_PER_MINUTE);
          // Non-working time = the window minus working ranges.
          const off: MinuteRange[] = [];
          let cursor = window.from;
          for (const r of [...c.working].sort((a, b) => a.from - b.from)) {
            if (r.from > cursor) off.push({ from: cursor, to: Math.min(r.from, window.to) });
            cursor = Math.max(cursor, r.to);
          }
          if (cursor < window.to) off.push({ from: cursor, to: window.to });

          return (
            <div key={c.key} className="relative border-l border-border" style={{ height }}>
              {off.map((r) => (
                <div
                  key={`off-${r.from}`}
                  aria-hidden="true"
                  className="absolute inset-x-0 bg-fill"
                  style={{ top: (r.from - window.from) * PX_PER_MINUTE, height: (r.to - r.from) * PX_PER_MINUTE }}
                />
              ))}
              {hours.map((m) => (
                <div
                  key={`line-${m}`}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-border"
                  style={{ top: (m - window.from) * PX_PER_MINUTE }}
                />
              ))}
              {c.addHref
                ? halfHours.map((m) => (
                    <Link
                      prefetch={false}
                      key={`add-${m}`}
                      href={c.addHref!(hhmm(m))}
                      aria-label={`Add an appointment at ${clockLabel(m)}, ${c.title}`}
                      className="absolute inset-x-0 hover:bg-primary-soft/60 focus-visible:bg-primary-soft"
                      style={{ top: (m - window.from) * PX_PER_MINUTE, height: 30 * PX_PER_MINUTE }}
                    />
                  ))
                : null}
              {blocks.map((b) => (
                <div
                  key={b.id}
                  className="hatch absolute inset-x-1 overflow-hidden rounded-inner border border-border px-2 py-1 text-caption text-ink-muted"
                  style={{ top: b.top, height: b.height }}
                >
                  {b.reason ?? "Time off"}
                </div>
              ))}
              {items.map((a) => {
                const tone = STATUS[a.status];
                const compact = a.height < 44;
                return (
                  <Link
                    prefetch={false}
                    key={a.id}
                    href={hrefFor(a)}
                    className="absolute z-10 flex overflow-hidden rounded-inner border border-border bg-card text-left shadow-pop transition-transform hover:-translate-y-px"
                    style={{
                      top: a.top + 1,
                      height: a.height - 2,
                      left: `calc(${(a.lane / a.lanes) * 100}% + 3px)`,
                      width: `calc(${100 / a.lanes}% - 6px)`,
                    }}
                  >
                    <span aria-hidden="true" className={`absolute inset-0 ${tone.soft}`} />
                    <span aria-hidden="true" className={`relative w-1 shrink-0 ${tone.bar}`} />
                    <span
                      className={`relative min-w-0 flex-1 px-2 ${compact ? "flex items-center gap-1.5 py-0" : "py-1"}`}
                    >
                      <span className="block truncate text-caption font-semibold tabular-nums">
                        {formatTime(a.startsAt, timezone)}
                        {a.source === "walk_in" ? " · Walk-in" : ""}
                      </span>
                      <span className="block truncate text-small font-medium">{a.customerName}</span>
                      {compact ? null : (
                        <span className="block truncate text-caption text-ink-muted">{a.serviceName}</span>
                      )}
                      <span className="sr-only">, {tone.label}</span>
                    </span>
                  </Link>
                );
              })}
              {nowTop !== null ? (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                  <div className="relative border-t-2 border-danger">
                    <span className="absolute -top-1 -left-1 size-2 rounded-full bg-danger" />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
