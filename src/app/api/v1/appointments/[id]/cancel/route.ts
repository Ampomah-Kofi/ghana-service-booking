import { AppError } from "@/lib/errors";
import { cancelAppointmentBody } from "@/schemas/api-v1";
import { toApiAppointment } from "@/server/api/appointments";
import { apiError, apiUser, json, validationError } from "@/server/api/http";
import { cancelMyAppointment, getAppointment } from "@/server/bookings/appointments";

/** POST /api/v1/appointments/{id}/cancel (Bearer): the customer cancels within the business's window. */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/appointments/[id]/cancel">) {
  const { id } = await params;
  try {
    const { db } = await apiUser(request);
    const parsed = cancelAppointmentBody.safeParse((await request.json().catch(() => ({}))) ?? {});
    if (!parsed.success) return validationError(parsed.error);
    await cancelMyAppointment(db, id, parsed.data.reason || null);
    const cancelled = await getAppointment(db, id);
    if (!cancelled) throw new AppError("NOT_FOUND", "Booking not found.");
    return json({ data: toApiAppointment(cancelled) }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
