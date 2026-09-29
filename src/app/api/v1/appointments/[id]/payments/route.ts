import { AppError } from "@/lib/errors";
import { apiError, apiUser, json, uuidParam } from "@/server/api/http";
import { toApiPayment } from "@/server/api/payments";
import { getAppointment } from "@/server/bookings/appointments";
import { listAppointmentPayments } from "@/server/payments/service";

/**
 * GET /api/v1/appointments/{id}/payments (Bearer): what the business has marked paid on this booking
 * (its customer, or the business's owners and managers). Nothing is paid through the API (ADR-0017).
 */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/appointments/[id]/payments">) {
  const { id } = await params;
  try {
    const { db } = await apiUser(request);
    uuidParam(id, "Booking not found.");
    const appointment = await getAppointment(db, id);
    if (!appointment) throw new AppError("NOT_FOUND", "Booking not found.");
    const payments = await listAppointmentPayments(db, id);
    return json({ data: payments.map(toApiPayment) }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
