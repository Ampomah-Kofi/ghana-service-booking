import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { localDateOf } from "@/lib/availability";
import { formatDuration } from "@/lib/hours";
import { formatPrice } from "@/lib/money";
import { localDateSchema } from "@/schemas/booking";
import { memberBusinessOr404 } from "@/server/businesses/access";
import { listServices } from "@/server/businesses/catalog";
import { listStaff } from "@/server/businesses/team";
import { listClients } from "@/server/clients/clients";
import { NewAppointmentForm } from "./new-appointment-form";

export const metadata: Metadata = { title: "New appointment" };

export default async function NewAppointmentPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/appointments/new">) {
  const { businessId } = await params;
  const sp = await searchParams;
  const { db, business, canManage, ownStaffId } = await memberBusinessOr404(businessId);
  const walkIn = sp.walkIn === "1";
  const [services, staff, clients] = await Promise.all([
    listServices(db, business.id),
    listStaff(db, business.id, { withInvites: false }),
    canManage ? listClients(db, business.id, { limit: 500 }) : Promise.resolve([]),
  ]);

  const people = staff.filter((s) => s.isActive && (canManage || s.id === ownStaffId));
  const offered = services.filter((s) => s.isActive && s.staffIds.some((id) => people.some((p) => p.id === id)));
  const now = new Date();
  const today = localDateOf(now, business.timezone);
  const staffParam = typeof sp.staff === "string" ? sp.staff : "";
  const date = typeof sp.date === "string" && localDateSchema.safeParse(sp.date).success ? sp.date : today;
  const time =
    typeof sp.time === "string" && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : nextQuarter(now, business.timezone);

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/dashboard/${business.id}/calendar`}
        className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-0.5 text-small font-medium text-primary"
      >
        <ChevronLeftIcon /> Calendar
      </Link>
      <h1 className="mb-1 text-display font-bold">{walkIn ? "Add walk-in" : "New appointment"}</h1>
      <p className="mb-5 text-body text-ink-muted">
        {walkIn
          ? "Starts now. Pick the service and you're done."
          : "For bookings made by phone, WhatsApp or in person."}
      </p>
      <NewAppointmentForm
        businessId={business.id}
        walkIn={walkIn}
        services={offered.map((s) => ({
          id: s.id,
          name: s.name,
          detail: `${formatDuration(s.durationMinutes)} · ${formatPrice(s.priceMinor, s.priceType, business.currency)}`,
          staffIds: s.staffIds,
        }))}
        staff={people.map((p) => ({ id: p.id, name: p.displayName, detail: p.roleTitle ?? "" }))}
        clients={clients.map((c) => ({ id: c.id, name: c.phone ? `${c.name} (${c.phone})` : c.name }))}
        defaults={{
          serviceId: offered.length === 1 ? offered[0].id : "",
          staffId: people.some((p) => p.id === staffParam) ? staffParam : (ownStaffId ?? people[0]?.id ?? ""),
          date,
          time,
        }}
      />
    </div>
  );
}

/** The next quarter hour in the business's timezone, e.g. "14:15". */
function nextQuarter(now: Date, timezone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const minutes = Math.min(23 * 60 + 45, Math.ceil((Number(parts.hour) * 60 + Number(parts.minute)) / 15) * 15);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
