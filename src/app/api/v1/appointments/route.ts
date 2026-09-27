import { AppError } from "@/lib/errors";
import { createAppointmentBody } from "@/schemas/api-v1";
import { phoneInputSchema } from "@/schemas/auth";
import { idempotencyKeySchema } from "@/schemas/booking";
import { toApiAppointment } from "@/server/api/appointments";
import { apiError, apiUser, json, validationError } from "@/server/api/http";
import { bookAppointment, getAppointment } from "@/server/bookings/appointments";
import { getBusinessById } from "@/server/businesses/queries";
import { serverEnv } from "@/server/env";

/**
 * POST /api/v1/appointments (Bearer required, `Idempotency-Key` header required).
 * Retrying with the same key returns the original booking instead of a second one.
 */
export async function POST(request: Request) {
  try {
    const { db } = await apiUser(request);
    const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key") ?? "");
    if (!key.success) throw new AppError("VALIDATION", "Send an Idempotency-Key header (8-100 characters).");
    const parsed = createAppointmentBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    let phone: string | null = null;
    if (input.customer_phone) {
      const result = phoneInputSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse(input.customer_phone);
      if (!result.success) throw new AppError("VALIDATION", "customer_phone is not a valid phone number.");
      phone = result.data;
    }
    const business = await getBusinessById(db, input.business_id);
    if (!business || business.status !== "published") throw new AppError("NOT_FOUND", "Business not found.");
    const id = await bookAppointment(db, business, {
      businessId: business.id,
      serviceId: input.service_id,
      staffId: input.staff_id === "any" ? null : input.staff_id,
      startsAt: new Date(input.starts_at),
      customerName: input.customer_name,
      customerPhone: phone,
      note: input.note || null,
      idempotencyKey: key.data,
    });
    const created = await getAppointment(db, id);
    if (!created) throw new AppError("INTERNAL", "Booked, but the booking could not be loaded.");
    return json({ data: toApiAppointment(created) }, { status: 201, personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
