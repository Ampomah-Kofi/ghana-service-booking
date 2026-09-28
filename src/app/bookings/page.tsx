import type { Metadata } from "next";
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
  const { upcoming, past } = await listMyAppointments(await createUserClient(), user.id);

  return (
    <>
      <h1 className="mb-6 text-display font-bold">Your bookings</h1>
      <GroupedSection title="Upcoming">
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
      {past.length > 0 ? (
        <GroupedSection title="Past and cancelled">
          <ul className="ios-list">
            {past.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                href={`/bookings/${a.id}`}
                who={a.business.name ?? "Business"}
                action={
                  a.business.slug
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
