import { AppError } from "@/lib/errors";
import { addDays, localToInstant } from "@/lib/availability";
import { businessAppointmentsQuery, createManualAppointmentBody } from "@/schemas/api-v1";
import { phoneInputSchema } from "@/schemas/auth";
import { apiMember, toApiAppointment } from "@/server/api/appointments";
import { apiError, json, validationError } from "@/server/api/http";
import { getAppointment, listBusinessAppointments } from "@/server/bookings/appointments";
import { addManualAppointment } from "@/server/bookings/manage";
import { serverEnv } from "@/server/env";

/**
 * GET /api/v1/businesses/{slug}/appointments?from=&days= (Bearer, business members).
 * Managers get everyone's appointments; staff only their own (RLS).
 */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/businesses/[slug]/appointments">) {
  const { slug } = await params;
  const parsed = businessAppointmentsQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const member = await apiMember(request, slug);
    const tz = member.business.timezone;
    const appointments = await listBusinessAppointments(member.db, member.business.id, {
      from: localToInstant(parsed.data.from, 0, tz),
      to: localToInstant(addDays(parsed.data.from, parsed.data.days - 1), 1440, tz),
      includeCancelled: parsed.data.include_cancelled === "true",
    });
    return json(
      {
        data: appointments.map(toApiAppointment),
        meta: { timezone: tz, can_manage: member.canManage, own_staff_id: member.ownStaffId },
      },
      { personalised: true },
    );
  } catch (error) {
    return apiError(error);
  }
}

/** POST /api/v1/businesses/{slug}/appointments (Bearer): a phone booking or a walk-in. */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/businesses/[slug]/appointments">) {
  const { slug } = await params;
  try {
    const member = await apiMember(request, slug);
    const parsed = createManualAppointmentBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!input.walk_in && !input.starts_at)
      throw new AppError("VALIDATION", "starts_at is required unless walk_in is true.");
    let phone: string | null = null;
    if (input.client?.phone) {
      const result = phoneInputSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse(input.client.phone);
      if (!result.success) throw new AppError("VALIDATION", "client.phone is not a valid phone number.");
      phone = result.data;
    }
    const id = await addManualAppointment(member.db, member.business.id, {
      serviceId: input.service_id,
      staffId: input.staff_id,
      startsAt: input.starts_at && !input.walk_in ? new Date(input.starts_at) : new Date(),
      client: input.client_id ? { id: input.client_id } : { name: input.client?.name ?? "", phone },
      note: input.note || null,
      walkIn: input.walk_in,
      allowOutsideHours: input.walk_in || input.allow_outside_hours,
    });
    const created = await getAppointment(member.db, id);
    if (!created) throw new AppError("INTERNAL", "Added, but the appointment could not be loaded.");
    return json({ data: toApiAppointment(created) }, { status: 201, personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
