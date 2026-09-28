import { AppError } from "@/lib/errors";
import { publicEnv } from "@/lib/public-env";
import { startPaymentSchema } from "@/schemas/payments";
import { apiError, apiUser, json, uuidParam, validationError } from "@/server/api/http";
import { toApiPayment } from "@/server/api/payments";
import { getAppointment } from "@/server/bookings/appointments";
import { serverEnv } from "@/server/env";
import { listAppointmentPayments, startPayment } from "@/server/payments/service";

/** GET /api/v1/appointments/{id}/payments (Bearer): the booking's payments (its customer, or the business). */
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

/**
 * POST /api/v1/appointments/{id}/payments (Bearer): the customer starts paying the deposit (or the
 * full price, where the business allows it). Same rules and validation as the Pay screen. The answer
 * says what happens next: open a URL, or approve the prompt on the phone and poll GET.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/appointments/[id]/payments">) {
  const { id } = await params;
  try {
    const { db } = await apiUser(request);
    uuidParam(id, "Booking not found.");
    const parsed = startPaymentSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse(
      (await request.json().catch(() => null)) ?? {},
    );
    if (!parsed.success) return validationError(parsed.error);
    const appointment = await getAppointment(db, id);
    if (!appointment) throw new AppError("NOT_FOUND", "Booking not found.");
    const input = parsed.data;
    const site = publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    const result = await startPayment(db, {
      appointmentId: appointment.id,
      kind: input.kind,
      method: input.method,
      phoneE164: input.method === "mobile_money" ? input.phone : undefined,
      network: input.method === "mobile_money" ? input.network : undefined,
      customerName: appointment.customerName,
      description: `${input.kind === "deposit" ? "Deposit" : "Payment"} for ${appointment.serviceName} at ${appointment.business.name ?? "the business"}`,
      returnUrl: `${site}/bookings/${appointment.id}`,
    });
    const next =
      result.next.type === "await_customer_approval"
        ? { type: result.next.type, message: result.next.message }
        : result.next;
    return json(
      {
        data: {
          payment_id: result.paymentId,
          amount: { amount_minor: result.amountMinor, currency: result.currency },
          next,
        },
      },
      { status: 201, personalised: true },
    );
  } catch (error) {
    return apiError(error);
  }
}
