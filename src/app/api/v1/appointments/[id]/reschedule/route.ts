import { AppError } from "@/lib/errors";
import { rescheduleAppointmentBody } from "@/schemas/api-v1";
import { toApiAppointment } from "@/server/api/appointments";
import { apiError, apiUser, json, validationError } from "@/server/api/http";
import { getAppointment, rescheduleMyAppointment } from "@/server/bookings/appointments";

/**
 * POST /api/v1/appointments/{id}/reschedule (Bearer): moves a booking in one step.
 * If the new time is taken, the original booking is left exactly as it was.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/appointments/[id]/reschedule">) {
  const { id } = await params;
  try {
    const { db, userId } = await apiUser(request);
    const parsed = rescheduleAppointmentBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    const current = await getAppointment(db, id);
    if (!current || current.customerUserId !== userId) throw new AppError("NOT_FOUND", "Booking not found.");
    const newId = await rescheduleMyAppointment(db, current, {
      staffId: parsed.data.staff_id === "any" ? null : parsed.data.staff_id,
      startsAt: new Date(parsed.data.starts_at),
    });
    const moved = await getAppointment(db, newId);
    if (!moved) throw new AppError("INTERNAL", "Moved, but the booking could not be loaded.");
    return json({ data: toApiAppointment(moved) }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
