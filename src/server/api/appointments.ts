import "server-only";
import type { z } from "zod";
import type { appointment } from "@/schemas/api-v1";
import { customerCanChange, type AppointmentView } from "@/server/bookings/appointments";

/** AppointmentView → the public API shape (snake_case, money as minor units + currency). */
export function toApiAppointment(a: AppointmentView): z.infer<typeof appointment> {
  const currency = a.price.currency.code;
  return {
    id: a.id,
    status: a.status,
    starts_at: new Date(a.startsAt).toISOString(),
    ends_at: new Date(a.endsAt).toISOString(),
    business: { id: a.business.id, name: a.business.name, slug: a.business.slug, timezone: a.business.timezone },
    service: { id: a.serviceId, name: a.serviceName },
    staff: { id: a.staffId, display_name: a.staffName },
    price: { amount_minor: a.price.amountMinor, currency, type: a.price.type },
    deposit: a.depositMinor ? { amount_minor: a.depositMinor, currency } : null,
    payment_status: a.paymentStatus,
    customer: { name: a.customerName, phone: a.customerPhone },
    note: a.note,
    cancellation_reason: a.cancellationReason,
    can_change: customerCanChange(a),
  };
}
