import "server-only";
import type { z } from "zod";
import type { appointment } from "@/schemas/api-v1";
import { AppError } from "@/lib/errors";
import { MANAGER_ROLES } from "@/server/auth/roles";
import type { MemberBusiness } from "@/server/businesses/access";
import { getBusinessBySlug } from "@/server/businesses/queries";
import { customerCanChange, type AppointmentView } from "@/server/bookings/appointments";
import { apiUser } from "./http";

/** AppointmentView → the public API shape (snake_case, money as minor units + currency). */
export function toApiAppointment(a: AppointmentView): z.infer<typeof appointment> {
  const currency = a.price.currency.code;
  return {
    id: a.id,
    status: a.status,
    source: a.source,
    starts_at: new Date(a.startsAt).toISOString(),
    ends_at: new Date(a.endsAt).toISOString(),
    business: { id: a.business.id, name: a.business.name, slug: a.business.slug, timezone: a.business.timezone },
    service: { id: a.serviceId, name: a.serviceName },
    staff: { id: a.staffId, display_name: a.staffName },
    price: { amount_minor: a.price.amountMinor, currency, type: a.price.type },
    deposit: a.depositMinor ? { amount_minor: a.depositMinor, currency } : null,
    final_price: a.finalPriceMinor !== null ? { amount_minor: a.finalPriceMinor, currency } : null,
    payment_status: a.paymentStatus,
    hold_expires_at: a.holdExpiresAt ? new Date(a.holdExpiresAt).toISOString() : null,
    customer: { name: a.customerName, phone: a.customerPhone },
    note: a.note,
    cancellation_reason: a.cancellationReason,
    can_change: customerCanChange(a),
  };
}

/**
 * A signed-in member of the business named by `slug` (Bearer token). Non-members get 404,
 * so the API never reveals whether a draft business exists.
 */
export async function apiMember(request: Request, slug: string): Promise<MemberBusiness> {
  const { db, userId } = await apiUser(request);
  const business = await getBusinessBySlug(db, slug);
  if (!business) throw new AppError("NOT_FOUND", "Business not found.");
  const [{ data: membership }, { data: own }] = await Promise.all([
    db.from("business_members").select("role").eq("business_id", business.id).eq("user_id", userId).maybeSingle(),
    db
      .from("staff")
      .select("id")
      .eq("business_id", business.id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (!membership) throw new AppError("NOT_FOUND", "Business not found.");
  return {
    db,
    business,
    role: membership.role,
    canManage: MANAGER_ROLES.includes(membership.role),
    ownStaffId: own?.id ?? null,
  };
}
