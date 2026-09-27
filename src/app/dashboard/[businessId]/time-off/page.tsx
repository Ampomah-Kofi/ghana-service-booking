import type { Metadata } from "next";
import { TimeOffForm } from "@/components/business/time-off-form";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listUpcomingBlockedTimes } from "@/server/businesses/schedule";
import { listStaff } from "@/server/businesses/team";
import { deleteBlockedTimeAction } from "../schedule-actions";

export const metadata: Metadata = { title: "Time off" };

export default async function TimeOffPage({ params }: PageProps<"/dashboard/[businessId]/time-off">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const [blocks, staff] = await Promise.all([
    listUpcomingBlockedTimes(db, business.id),
    listStaff(db, business.id, { withInvites: false }),
  ]);
  const names = new Map(staff.map((s) => [s.id, s.displayName]));
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: business.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: business.timezone }).format(new Date());

  return (
    <>
      <h1 className="text-display font-bold tracking-tight">Time off</h1>
      <p className="mb-5 mt-2 text-body text-ink-muted">
        Holidays, days off and breaks. Customers can&apos;t book these times.
      </p>

      <section aria-labelledby="upcoming" className="mb-8">
        <h2 id="upcoming" className="mb-2 px-4 text-heading font-semibold text-ink">
          Upcoming
        </h2>
        {blocks.length === 0 ? (
          <p className="rounded-card bg-card p-4 text-body text-ink-muted border border-border">No time off planned.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-card border border-border">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium">
                    {b.staffId ? (names.get(b.staffId) ?? "Team member") : "Whole business"}
                  </p>
                  <p className="text-small text-ink-muted tabular-nums">
                    {format.format(new Date(b.startsAt))} – {format.format(new Date(b.endsAt))}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </p>
                </div>
                <form action={deleteBlockedTimeAction}>
                  <input type="hidden" name="businessId" value={business.id} />
                  <input type="hidden" name="blockId" value={b.id} />
                  <button type="submit" className="min-h-11 px-2 text-small text-danger">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="mb-2 px-4 text-heading font-semibold text-ink">Add time off</h2>
      <TimeOffForm
        businessId={business.id}
        staff={business.kind === "team" ? staff.map((s) => ({ id: s.id, name: s.displayName })) : null}
        today={today}
      />
    </>
  );
}
