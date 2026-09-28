import Link from "next/link";
import { dayPill } from "@/lib/datetime";
import { monthCells, monthsInRange } from "@/lib/date-grid";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Jump to any bookable date (docs/design.md: date step). The date is split into two taps,
 * Month and Day; the tapped one is outlined and a short line joins it to a grid that opens
 * right under it. Built on exclusive `<details name>`, so it works without JavaScript; each cell
 * is a plain link. The day strip below stays for the next few days.
 */
export function DateJump({
  today,
  lastDate,
  selected,
  hrefFor,
}: {
  today: string;
  lastDate: string;
  selected: string;
  hrefFor: (date: string) => string;
}) {
  const months = monthsInRange(today, lastDate);
  const monthKey = selected.slice(0, 7);
  const current = months.find((m) => m.key === monthKey) ?? months[0];
  const showYear = months[0].year !== months[months.length - 1].year;
  const pill = dayPill(selected);

  return (
    <div className="relative mb-3 flex items-center gap-2">
      <Segment label="Month" value={showYear ? `${current.label} ${current.year}` : current.label}>
        <p className="mb-3 text-heading font-semibold">Select month</p>
        <ul className="grid grid-cols-3 gap-2">
          {months.map((m) => {
            const target = m.first < today ? today : m.first;
            const active = m.key === monthKey;
            return (
              <li key={m.key}>
                <Link
                  href={hrefFor(target)}
                  aria-current={active ? "date" : undefined}
                  className={`${CELL} min-h-11 ${active ? SELECTED : "hover:bg-fill"}`}
                >
                  {m.label}
                  {showYear ? ` ${String(m.year).slice(2)}` : ""}
                </Link>
              </li>
            );
          })}
        </ul>
      </Segment>

      <Segment label="Day" value={`${pill.weekday} ${pill.day}`}>
        <p className="mb-3 text-heading font-semibold">
          Select day · {current.label}
          {showYear ? ` ${current.year}` : ""}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center" role="presentation">
          {WEEKDAYS.map((w, i) => (
            <span key={i} aria-hidden="true" className="pb-1 text-caption font-semibold text-ink-muted">
              {w}
            </span>
          ))}
          {monthCells(current.key).map((date, i) => {
            if (!date) return <span key={`blank-${i}`} aria-hidden="true" />;
            const day = Number(date.slice(8));
            const bookable = date >= today && date <= lastDate;
            if (!bookable) {
              return (
                <span key={date} aria-hidden="true" className={`${CELL} min-h-10 text-ink-muted/50`}>
                  {day}
                </span>
              );
            }
            const active = date === selected;
            return (
              <Link
                key={date}
                href={hrefFor(date)}
                aria-current={active ? "date" : undefined}
                aria-label={`${dayPill(date).weekday} ${day} ${current.label}`}
                className={`${CELL} min-h-10 tabular-nums ${
                  active ? SELECTED : date === today ? "font-bold text-primary hover:bg-fill" : "hover:bg-fill"
                }`}
              >
                {day}
              </Link>
            );
          })}
        </div>
      </Segment>

      {selected !== today ? (
        <Link
          href={hrefFor(today)}
          className="pressable ml-auto inline-flex min-h-11 items-center rounded-full px-3 text-small font-semibold text-primary hover:bg-fill"
        >
          Today
        </Link>
      ) : null}
    </div>
  );
}

const CELL = "flex items-center justify-center rounded-control text-body";
const SELECTED = "bg-primary-soft font-semibold text-primary";

/** One tap of the split date. Only one opens at a time (`name` on details). */
function Segment({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <details name="date-jump" className="group">
      <summary
        aria-label={`${label}: ${value}. Change`}
        className="pressable relative flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full bg-fill px-4 text-body font-semibold group-open:bg-card group-open:ring-2 group-open:ring-primary [&::-webkit-details-marker]:hidden"
      >
        {value}
        <svg
          viewBox="0 0 12 12"
          className="size-3 text-ink-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          <path
            d="m2.5 4.5 3.5 3.5 3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {/* The line joining the open tap to its grid. */}
        <span
          aria-hidden="true"
          className="absolute top-full left-1/2 hidden h-3 w-0.5 -translate-x-1/2 bg-primary group-open:block"
        />
      </summary>
      <div className="sheet-up absolute inset-x-0 top-full z-10 mt-3 rounded-card bg-card p-4 shadow-pop">
        {children}
      </div>
    </details>
  );
}
