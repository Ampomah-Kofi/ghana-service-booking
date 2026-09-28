import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { localDateOf } from "@/lib/availability";
import { formatDateShort, formatTime } from "@/lib/datetime";
import { memberBusinessOr404 } from "@/server/businesses/access";
import { getAppointment } from "@/server/bookings/appointments";
import { listStaff } from "@/server/businesses/team";
import { MoveForm } from "./move-form";

export const metadata: Metadata = { title: "Move appointment" };

export default async function MoveAppointmentPage({
  params,
}: PageProps<"/dashboard/[businessId]/appointments/[appointmentId]/move">) {
  const { businessId, appointmentId } = await params;
  const { db, business, canManage } = await memberBusinessOr404(businessId);
  if (!canManage) notFound();
  const a = await getAppointment(db, appointmentId);
  if (!a || a.business.id !== business.id || (a.status !== "pending" && a.status !== "confirmed")) notFound();
  const staff = (await listStaff(db, business.id, { withInvites: false })).filter(
    (s) => s.isActive && s.serviceIds.includes(a.serviceId),
  );
  const tz = business.timezone;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(a.startsAt));

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/dashboard/${business.id}/appointments/${a.id}`}
        className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-0.5 text-small font-medium text-primary"
      >
        <ChevronLeftIcon /> Appointment
      </Link>
      <h1 className="mb-1 text-display font-bold">Move appointment</h1>
      <p className="mb-5 text-body text-ink-muted">
        {a.customerName} · {a.serviceName} · now {formatDateShort(a.startsAt, tz)} at {formatTime(a.startsAt, tz)}
      </p>
      <MoveForm
        businessId={business.id}
        appointmentId={a.id}
        staff={staff.map((s) => ({ id: s.id, name: s.displayName }))}
        defaults={{ staffId: a.staffId, date: localDateOf(new Date(a.startsAt), tz), time }}
      />
      <p className="mt-3 text-small text-ink-muted">
        Moving doesn&apos;t notify the customer yet (messages arrive in a later update). Let them know by phone or
        WhatsApp.
      </p>
    </div>
  );
}
