import type { Metadata } from "next";
import { reviewedAppointmentIds } from "@/server/reviews/reviews";
import { EmptyState } from "@/components/ui/empty-state";
import { TicketIcon } from "@/components/ui/icons";
import { LargeTitle } from "@/components/ui/large-title";
import Link from "next/link";
import { AppointmentRow } from "@/components/bookings/appointment-row";
import { GroupedSection } from "@/components/ui/card";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listMyAppointments } from "@/server/bookings/appointments";
import { createUserClient } from "@/server/db/supabase-server";
import { rebookHref } from "@/lib/rebook";

export const metadata: Metadata = { title: "Your bookings" };

export default async function BookingsPage() {
  const user = await requireUserOrRedirect("/bookings");
  const db = await createUserClient();
  const { upcoming, past } = await listMyAppointments(db, user.id);
  const reviewed = await reviewedAppointmentIds(
    db,
    user.id,
    past.filter((a) => a.status === "completed").map((a) => a.id),
  );

  return (
    <>
      <LargeTitle title="Bookings" className="mb-6" />
      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title="No bookings yet"
          body="When you book a barber, braider or anyone else, it shows up here."
          action={{ href: "/", label: "Find a professional", primary: true }}
        />
      ) : (
        <GroupedSection title="Upcoming" sticky>
          {upcoming.length === 0 ? (
            <p className="px-4 py-3 text-body text-ink-muted">
              Nothing booked yet.{" "}
              <Link href="/" className="font-medium text-primary">
                Find a professional
              </Link>
            </p>
          ) : (
            <ul className="ios-list">
              {upcoming.map((a) => (
                <AppointmentRow
                  key={a.id}
                  appointment={a}
                  href={`/bookings/${a.id}`}
                  who={a.business.name ?? "Business"}
                />
              ))}
            </ul>
          )}
        </GroupedSection>
      )}
      {past.length > 0 ? (
        <GroupedSection title="Past and cancelled" sticky>
          <ul className="ios-list">
            {past.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                href={`/bookings/${a.id}`}
                who={a.business.name ?? "Business"}
                action={
                  a.status === "completed" && !reviewed.has(a.id)
                    ? { href: `/bookings/${a.id}#rate`, label: "Rate" }
                    : a.business.slug
                      ? { href: rebookHref(a.business.slug, a.serviceId, a.staffId), label: "Book again" }
                      : undefined
                }
              />
            ))}
          </ul>
        </GroupedSection>
      ) : null}
    </>
  );
}
