import Link from "next/link";
import { STATUS } from "@/components/bookings/status-badge";
import { monthGrid } from "@/lib/calendar-layout";
import type { AppointmentStatus } from "@/server/bookings/appointments";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month view: how busy each day is at a glance; tap a day to open it. */
export function MonthGrid({
  date,
  today,
  byDate,
  dayHref,
}: {
  date: string;
  today: string;
  byDate: Map<string, AppointmentStatus[]>;
  dayHref: (date: string) => string;
}) {
  const cells = monthGrid(date);
  return (
    <div className="overflow-hidden rounded-card bg-card lift">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <p key={d} className="py-2 text-center text-caption text-ink-muted">
            {d}
          </p>
        ))}
      </div>
      <ol className="grid grid-cols-7">
        {cells.map(({ date: d, inMonth }) => {
          const statuses = byDate.get(d) ?? [];
          const count = statuses.length;
          const isToday = d === today;
          return (
            <li key={d} className="border-b border-l border-border [&:nth-child(7n+1)]:border-l-0">
              <Link
                prefetch={false}
                href={dayHref(d)}
                aria-label={`${d}${count ? `, ${count} appointment${count === 1 ? "" : "s"}` : ", nothing booked"}`}
                className={`flex min-h-16 flex-col items-center gap-1 px-1 py-1.5 hover:bg-fill ${inMonth ? "" : "text-ink-muted/60"}`}
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-small tabular-nums ${
                    isToday ? "bg-primary font-semibold text-on-primary" : ""
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                {count > 0 ? (
                  <span className="flex items-center gap-0.5" aria-hidden="true">
                    {statuses.slice(0, 3).map((s, i) => (
                      <span key={i} className={`size-1.5 rounded-full ${STATUS[s].bar}`} />
                    ))}
                    {count > 3 ? <span className="text-caption text-ink-muted">+{count - 3}</span> : null}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
