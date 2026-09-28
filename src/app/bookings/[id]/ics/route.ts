import { buildIcs } from "@/lib/ics";
import { publicEnv } from "@/lib/public-env";
import { getCurrentUser } from "@/server/auth/session";
import { getAppointment } from "@/server/bookings/appointments";
import { formatPlace, getBusinessBySlug } from "@/server/businesses/queries";
import { createUserClient } from "@/server/db/supabase-server";

/** "Add to calendar": the signed-in customer's own booking as an .ics file (ADR-0012). */
export async function GET(_request: Request, { params }: RouteContext<"/bookings/[id]/ics">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to download this booking.", { status: 401 });
  const db = await createUserClient();
  const a = await getAppointment(db, id);
  // RLS already limits reads; this page is only for the booking's own customer.
  if (!a || a.customerUserId !== user.id) return new Response("Not found", { status: 404 });

  const business = a.business.slug ? await getBusinessBySlug(db, a.business.slug) : null;
  const loc = business?.location ?? null;
  const where = [business?.name ?? a.business.name, loc?.addressLine, formatPlace(loc)].filter(Boolean).join(", ");
  const site = publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const body = buildIcs({
    uid: `${a.id}@hyia`,
    start: new Date(a.startsAt),
    end: new Date(a.endsAt),
    summary: `${a.serviceName} · ${a.business.name ?? "Booking"}`,
    location: where || null,
    description: [
      a.staffName ? `With ${a.staffName}` : null,
      loc?.landmark ? `Landmark: ${loc.landmark}` : null,
      `Manage: ${site}/bookings/${a.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    url: `${site}/bookings/${a.id}`,
    status: a.status === "cancelled" ? "CANCELLED" : a.status === "pending" ? "TENTATIVE" : "CONFIRMED",
    alarmMinutes: 60,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${a.id.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
