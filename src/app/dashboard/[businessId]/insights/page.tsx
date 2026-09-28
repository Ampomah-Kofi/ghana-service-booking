import type { Metadata } from "next";
import Link from "next/link";
import { BarChart } from "@/components/business/bar-chart";
import { GroupedSection } from "@/components/ui/card";
import { LargeTitle } from "@/components/ui/large-title";
import { formatMoney } from "@/lib/money";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { bucketPerDay, getInsights, INSIGHT_PERIODS, parsePeriod } from "@/server/businesses/insights";

export const metadata: Metadata = { title: "Insights" };

const PERIOD_LABEL = { 7: "7 days", 30: "30 days", 90: "3 months" } as const;

/** A local date ("2026-09-28") shown as "28 Sep" (the database already worked in the business's timezone). */
function dayLabel(day: string, style: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(style === "long" ? { weekday: "short" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
const pct = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)}%`);

/** How the business is doing (SPEC §16): owners and managers. Staff never see money. */
export default async function InsightsPage({ params, searchParams }: PageProps<"/dashboard/[businessId]/insights">) {
  const { businessId } = await params;
  const sp = await searchParams;
  const days = parsePeriod(sp.days);
  const { db, business } = await managedBusinessOr404(businessId);
  const s = await getInsights(db, business.id, days);
  const money = (minor: number) =>
    formatMoney({ amountMinor: minor, currency: business.currency.code }, business.currency);
  const weekly = days === 90;
  const bars = bucketPerDay(s.per_day, weekly ? 7 : 1).map((d) => ({
    key: d.day,
    label: weekly ? `Week of ${dayLabel(d.day)}` : dayLabel(d.day, "long"),
    short: weekly ? dayLabel(d.day) : dayLabel(d.day).split(" ")[0],
    value: d.bookings,
  }));
  const walkIns = s.by_source.walk_in ?? 0;
  const empty = s.bookings === 0;

  const tiles: [string, string, string][] = [
    ["Bookings", String(s.bookings - s.cancelled), walkIns > 0 ? `${walkIns} walk-ins` : "online and by phone"],
    ["Completed", String(s.completed), `${money(s.completed_value_minor)} in visits`],
    ["Cancelled", pct(s.cancellationRate), `${s.cancelled} of ${s.bookings}`],
    ["No-shows", pct(s.noShowRate), `${s.noShows} didn't come`],
  ];

  return (
    <>
      <LargeTitle title="Insights" className="mb-1" />
      <p className="mb-4 text-body text-ink-muted">
        {dayLabel(s.from)} to {dayLabel(s.to)}, in your time zone.
      </p>
      <nav aria-label="Period" className="mb-5 flex gap-2">
        {INSIGHT_PERIODS.map((p) => (
          <Link
            key={p}
            href={`/dashboard/${business.id}/insights?days=${p}`}
            aria-current={p === days ? "page" : undefined}
            className="min-h-10 content-center rounded-full bg-fill px-4 text-small font-medium aria-[current=page]:bg-primary aria-[current=page]:text-on-primary"
          >
            {PERIOD_LABEL[p]}
          </Link>
        ))}
      </nav>

      <dl className="mb-6 grid grid-cols-2 gap-2">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="min-w-0 rounded-card bg-card px-3 py-3 lift">
            <dt className="text-small text-ink-muted">{label}</dt>
            <dd className="text-title font-bold tabular-nums">{value}</dd>
            <dd className="truncate text-caption text-ink-muted">{hint}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="per-day-heading" className="mb-6 rounded-card bg-card p-4 lift">
        <h2 id="per-day-heading" className="mb-3 text-heading font-semibold">
          Bookings per {weekly ? "week" : "day"}
        </h2>
        {empty ? (
          <p className="text-body text-ink-muted">No bookings in this period yet.</p>
        ) : (
          <BarChart
            title={`Bookings per ${weekly ? "week" : "day"}, ${PERIOD_LABEL[days]}`}
            bars={bars}
            unit="booking"
          />
        )}
      </section>

      <GroupedSection
        title="Money, as you recorded it"
        footer="Customers pay you directly. These are the payments you marked on appointments."
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-body">Received</span>
          <span className="text-body font-semibold tabular-nums">{money(s.recorded_minor)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-body">Refunded</span>
          <span className="text-body tabular-nums">{money(s.refunded_minor)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-body">Value of completed visits</span>
          <span className="text-body tabular-nums">{money(s.completed_value_minor)}</span>
        </div>
      </GroupedSection>

      <GroupedSection title="Most booked services">
        {s.top_services.length === 0 ? (
          <p className="px-4 py-3 text-body text-ink-muted">Nothing yet.</p>
        ) : (
          s.top_services.map((t) => (
            <div key={t.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate text-body">{t.name}</span>
              <span className="shrink-0 text-body tabular-nums">{t.count}</span>
            </div>
          ))
        )}
      </GroupedSection>

      {business.kind === "team" ? (
        <GroupedSection title="Most booked people">
          {s.top_staff.length === 0 ? (
            <p className="px-4 py-3 text-body text-ink-muted">Nothing yet.</p>
          ) : (
            s.top_staff.map((t) => (
              <div key={t.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-body">{t.name}</span>
                <span className="shrink-0 text-body tabular-nums">{t.count}</span>
              </div>
            ))
          )}
        </GroupedSection>
      ) : null}

      <GroupedSection title="Customers" footer="New means their first visit to you was in this period.">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-body">New</span>
          <span className="text-body tabular-nums">{s.customers.new}</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-body">Returning</span>
          <span className="text-body tabular-nums">{s.customers.returning}</span>
        </div>
      </GroupedSection>
    </>
  );
}
