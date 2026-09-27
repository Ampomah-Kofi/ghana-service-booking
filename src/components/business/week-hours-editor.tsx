"use client";

import { useId, useState } from "react";
import { type HoursRange, minutesOf, validateWeek, WEEKDAYS } from "@/lib/hours";

/**
 * Weekly hours with breaks (several ranges per day). Submits one hidden JSON
 * field named `name`; the server re-validates with the same rules.
 */
export function WeekHoursEditor({ name, initial }: { name: string; initial: HoursRange[] }) {
  const [ranges, setRanges] = useState<HoursRange[]>(initial);
  const problem = validateWeek(ranges);
  const id = useId();

  function update(index: number, patch: Partial<HoursRange>) {
    setRanges((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function toggleDay(day: number, open: boolean) {
    setRanges((current) =>
      open ? [...current, { weekday: day, opens: "09:00", closes: "18:00" }] : current.filter((r) => r.weekday !== day),
    );
  }

  function addBreak(day: number) {
    setRanges((current) => {
      const dayRanges = current.filter((r) => r.weekday === day);
      const last = dayRanges.reduce((a, b) => (minutesOf(a.closes) > minutesOf(b.closes) ? a : b));
      const start = Math.min(minutesOf(last.closes) + 60, 23 * 60);
      const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      return [...current, { weekday: day, opens: fmt(start), closes: fmt(Math.min(start + 120, 24 * 60 - 5)) }];
    });
  }

  function copyToAll(day: number) {
    setRanges((current) => {
      const template = current.filter((r) => r.weekday === day);
      const openDays = new Set(current.map((r) => r.weekday));
      return [
        ...current.filter((r) => !openDays.has(r.weekday) || r.weekday === day),
        ...WEEKDAYS.filter((w) => w.day !== day && openDays.has(w.day)).flatMap((w) =>
          template.map((t) => ({ ...t, weekday: w.day })),
        ),
      ];
    });
  }

  const timeInput =
    "min-h-11 min-w-0 flex-1 rounded-control border border-border bg-card px-2 text-body tabular-nums outline-none focus:border-primary";

  return (
    <div>
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(ranges.map((r) => ({ ...r, closes: r.closes === "00:00" ? "24:00" : r.closes })))}
      />
      <ul className="divide-y divide-border overflow-hidden rounded-card bg-card border border-border">
        {WEEKDAYS.map(({ day, long }) => {
          const dayRanges = ranges.map((r, index) => ({ ...r, index })).filter((r) => r.weekday === day);
          const open = dayRanges.length > 0;
          return (
            <li key={day} className="px-4 py-3">
              <div className="flex min-h-11 items-center justify-between gap-3">
                <label htmlFor={`${id}-${day}`} className="text-body font-medium">
                  {long}
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-small text-ink-muted">{open ? "Open" : "Closed"}</span>
                  <input
                    id={`${id}-${day}`}
                    type="checkbox"
                    role="switch"
                    checked={open}
                    onChange={(e) => toggleDay(day, e.target.checked)}
                  />
                </div>
              </div>
              {open ? (
                <div className="mt-2 grid gap-2">
                  {dayRanges.map((r, n) => (
                    <div key={r.index} className="flex items-center gap-2">
                      <input
                        type="time"
                        step={300}
                        aria-label={`${long} ${n === 0 ? "opens" : "reopens"}`}
                        value={r.opens}
                        onChange={(e) => update(r.index, { opens: e.target.value })}
                        className={timeInput}
                      />
                      <span aria-hidden="true" className="text-ink-muted">
                        –
                      </span>
                      <input
                        type="time"
                        step={300}
                        aria-label={`${long} closes`}
                        value={r.closes === "24:00" ? "00:00" : r.closes}
                        onChange={(e) =>
                          update(r.index, { closes: e.target.value === "00:00" ? "24:00" : e.target.value })
                        }
                        className={timeInput}
                      />
                      {dayRanges.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setRanges((current) => current.filter((_, i) => i !== r.index))}
                          className="flex size-11 shrink-0 items-center justify-center rounded-full text-title text-danger"
                          aria-label={`Remove ${long} period ${n + 1}`}
                        >
                          <span aria-hidden="true">⊖</span>
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-x-4">
                    <button
                      type="button"
                      onClick={() => addBreak(day)}
                      className="min-h-11 text-small font-medium text-primary"
                    >
                      Add a break
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToAll(day)}
                      className="min-h-11 text-small font-medium text-primary"
                    >
                      Copy to other open days
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {problem ? (
        <p role="alert" className="mt-3 rounded-control bg-danger/10 px-3 py-2 text-small text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
