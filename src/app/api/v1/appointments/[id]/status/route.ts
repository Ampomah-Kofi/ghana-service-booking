import { AppError } from "@/lib/errors";
import { statusChangeBody } from "@/schemas/api-v1";
import { toApiAppointment } from "@/server/api/appointments";
import { apiError, apiUser, json, validationError } from "@/server/api/http";
import { getAppointment } from "@/server/bookings/appointments";
import { setAppointmentStatus } from "@/server/bookings/manage";

/**
 * POST /api/v1/appointments/{id}/status (Bearer, the business's managers or the staff member).
 * Allowed changes are enforced in the database; see docs/api/v1.md.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/appointments/[id]/status">) {
  const { id } = await params;
  try {
    const { db } = await apiUser(request);
    const parsed = statusChangeBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    await setAppointmentStatus(db, id, parsed.data.status, {
      reason: parsed.data.reason || null,
      finalPriceMinor: parsed.data.final_price_minor ?? null,
    });
    const updated = await getAppointment(db, id);
    if (!updated) throw new AppError("NOT_FOUND", "Appointment not found.");
    return json({ data: toApiAppointment(updated) }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
