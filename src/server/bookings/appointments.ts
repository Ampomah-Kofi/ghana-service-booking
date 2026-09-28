import "server-only";
import { nullableArg, type Db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { toAppError } from "@/server/businesses/errors";
import { AppError } from "@/lib/errors";
import type { CurrencyInfo } from "@/lib/money";
import { candidatesFor, getBookingSetup, staffForService, type BookingSetup } from "@/server/scheduling/availability";

export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type PriceType = Database["public"]["Enums"]["price_type"];

export type AppointmentView = {
  id: string;
  status: AppointmentStatus;
  source: Database["public"]["Enums"]["appointment_source"];
  startsAt: string;
  endsAt: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string | null;
  price: { amountMinor: number; type: PriceType; currency: CurrencyInfo };
  depositMinor: number | null;
  paymentStatus: PaymentStatus | null;
  customerUserId: string | null;
  clientId: string | null;
  finalPriceMinor: number | null;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  note: string | null;
  cancellationReason: string | null;
  /** Waiting for a deposit (Phase 9): the slot is held until this time. */
  holdExpiresAt: string | null;
  business: {
    id: string;
    name: string | null;
    slug: string | null;
    timezone: string | null;
    phone: string | null;
    whatsapp: string | null;
    cancellationWindowHours: number | null;
    /** Customers may pay the whole price online (Phase 9). */
    allowFullPaymentOnline: boolean;
    /** No-shows get their deposit back (otherwise the business keeps it). */
    refundDepositOnNoShow: boolean;
  };
};

// Business, staff and rules are joined as the caller: a customer still sees their
// booking if the business later unpublishes, just without those details.
const appointmentSelect = `
  id, status, source, starts_at, ends_at, service_id, service_name, staff_id, price_minor, price_type,
  currency_code, deposit_minor, payment_status, customer_user_id, client_id, final_price_minor, created_at, customer_name, customer_phone_e164, customer_note,
  cancellation_reason, business_id, hold_expires_at,
  currencies ( code, symbol, minor_unit ),
  staff ( display_name ),
  businesses ( name, slug, timezone, phone_e164, whatsapp_e164, booking_rules ( cancellation_window_hours, allow_full_payment_online, refund_deposit_on_no_show ) )
` as const;

type AppointmentRow = {
  id: string;
  status: AppointmentStatus;
  source: Database["public"]["Enums"]["appointment_source"];
  starts_at: string;
  ends_at: string;
  service_id: string;
  service_name: string;
  staff_id: string;
  price_minor: number;
  price_type: PriceType;
  currency_code: string;
  deposit_minor: number | null;
  payment_status: PaymentStatus | null;
  customer_user_id: string | null;
  client_id: string | null;
  final_price_minor: number | null;
  created_at: string;
  customer_name: string;
  customer_phone_e164: string | null;
  customer_note: string | null;
  cancellation_reason: string | null;
  business_id: string;
  hold_expires_at: string | null;
  currencies: { code: string; symbol: string; minor_unit: number } | null;
  staff: { display_name: string } | null;
  businesses: {
    name: string;
    slug: string;
    timezone: string;
    phone_e164: string | null;
    whatsapp_e164: string | null;
    booking_rules: {
      cancellation_window_hours: number;
      allow_full_payment_online: boolean;
      refund_deposit_on_no_show: boolean;
    } | null;
  } | null;
};

function toView(row: AppointmentRow): AppointmentView {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    serviceId: row.service_id,
    serviceName: row.service_name,
    staffId: row.staff_id,
    staffName: row.staff?.display_name ?? null,
    price: {
      amountMinor: row.price_minor,
      type: row.price_type,
      currency: {
        code: row.currency_code,
        symbol: row.currencies?.symbol,
        minorUnit: row.currencies?.minor_unit ?? 2,
      },
    },
    depositMinor: row.deposit_minor,
    paymentStatus: row.payment_status,
    customerUserId: row.customer_user_id,
    clientId: row.client_id,
    finalPriceMinor: row.final_price_minor,
    createdAt: row.created_at,
    customerName: row.customer_name,
    customerPhone: row.customer_phone_e164,
    note: row.customer_note,
    cancellationReason: row.cancellation_reason,
    holdExpiresAt: row.hold_expires_at,
    business: {
      id: row.business_id,
      name: row.businesses?.name ?? null,
      slug: row.businesses?.slug ?? null,
      timezone: row.businesses?.timezone ?? null,
      phone: row.businesses?.phone_e164 ?? null,
      whatsapp: row.businesses?.whatsapp_e164 ?? null,
      cancellationWindowHours: row.businesses?.booking_rules?.cancellation_window_hours ?? null,
      allowFullPaymentOnline: row.businesses?.booking_rules?.allow_full_payment_online ?? false,
      refundDepositOnNoShow: row.businesses?.booking_rules?.refund_deposit_on_no_show ?? false,
    },
  };
}

export const LIVE_STATUSES: AppointmentStatus[] = ["pending", "confirmed", "arrived"];

/**
 * Whether the customer may still cancel or reschedule online. A hint for the UI;
 * cancel_my_appointment() enforces the same rule in the database.
 */
export function customerCanChange(appointment: AppointmentView, now = new Date()): boolean {
  if (appointment.status !== "pending" && appointment.status !== "confirmed") return false;
  const window = appointment.business.cancellationWindowHours;
  if (window === null) return false;
  return new Date(appointment.startsAt).getTime() - now.getTime() >= window * 3_600_000;
}

export type NewBooking = {
  businessId: string;
  serviceId: string;
  /** A staff id, or null for "any available professional". */
  staffId: string | null;
  startsAt: Date;
  customerName: string;
  customerPhone: string | null;
  note: string | null;
  idempotencyKey: string;
};

/**
 * Books an online appointment for the signed-in caller. The engine picks who to
 * try (fairest first); book_appointment() re-validates and the exclusion
 * constraint makes a double booking impossible (ADR-0003).
 */
export async function bookAppointment(
  db: Db,
  business: { id: string; timezone: string },
  input: NewBooking,
  setup?: BookingSetup,
): Promise<string> {
  const loaded = setup ?? (await getBookingSetup(db, business));
  const staffIds = await staffToTry(db, loaded, input.serviceId, input.staffId, input.startsAt);
  const { data, error } = await db.rpc("book_appointment", {
    p_business_id: business.id,
    p_service_id: input.serviceId,
    p_staff_ids: staffIds,
    p_starts_at: input.startsAt.toISOString(),
    p_customer_name: input.customerName,
    p_customer_phone: nullableArg(input.customerPhone),
    p_note: nullableArg(input.note),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw toAppError(error);
  return data;
}

/**
 * Fairest-first order from the engine. When the engine sees no free person we still
 * ask the database (with everyone eligible): it answers a retried idempotency key
 * with the original booking, and otherwise refuses with a clear conflict.
 */
async function staffToTry(
  db: Db,
  setup: BookingSetup,
  serviceId: string,
  staffId: string | null,
  startsAt: Date,
): Promise<string[]> {
  const ordered = await candidatesFor(db, setup, { serviceId, staffId, startsAt });
  if (ordered.length > 0) return ordered;
  const eligible = staffForService(setup, serviceId, staffId).map((s) => s.id);
  if (eligible.length === 0) throw new AppError("NOT_FOUND", "That service can't be booked online.");
  return eligible;
}

export async function rescheduleMyAppointment(
  db: Db,
  appointment: AppointmentView,
  params: { staffId: string | null; startsAt: Date },
): Promise<string> {
  if (!appointment.business.timezone) throw new AppError("CONFLICT", "This business isn't taking bookings now.");
  const setup = await getBookingSetup(db, { id: appointment.business.id, timezone: appointment.business.timezone });
  const staffIds = await staffToTry(db, setup, appointment.serviceId, params.staffId, params.startsAt);
  const { data, error } = await db.rpc("reschedule_my_appointment", {
    p_appointment_id: appointment.id,
    p_staff_ids: staffIds,
    p_starts_at: params.startsAt.toISOString(),
  });
  if (error) throw toAppError(error);
  return data;
}

export async function cancelMyAppointment(db: Db, appointmentId: string, reason: string | null): Promise<void> {
  const { error } = await db.rpc("cancel_my_appointment", {
    p_appointment_id: appointmentId,
    p_reason: nullableArg(reason),
  });
  if (error) throw toAppError(error);
}

/** One appointment the caller may see (their own, their business's, or their own as staff). */
export async function getAppointment(db: Db, appointmentId: string): Promise<AppointmentView | null> {
  const { data, error } = await db.from("appointments").select(appointmentSelect).eq("id", appointmentId).maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw toAppError(error);
  }
  return data ? toView(data) : null;
}

/** The caller's own bookings as a customer: upcoming (soonest first) and past (latest first). */
export async function listMyAppointments(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<{ upcoming: AppointmentView[]; past: AppointmentView[] }> {
  const { data, error } = await db
    .from("appointments")
    .select(appointmentSelect)
    .eq("customer_user_id", userId)
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) throw toAppError(error);
  const all = data.map(toView);
  const isUpcoming = (a: AppointmentView) =>
    new Date(a.endsAt).getTime() > now.getTime() && LIVE_STATUSES.includes(a.status);
  return {
    upcoming: all.filter(isUpcoming).reverse(),
    past: all.filter((a) => !isUpcoming(a)),
  };
}

/** A business's next bookings (managers: all staff; RLS enforces who sees what). */
export async function listBusinessUpcoming(
  db: Db,
  businessId: string,
  { limit = 20, now = new Date() }: { limit?: number; now?: Date } = {},
): Promise<AppointmentView[]> {
  const { data, error } = await db
    .from("appointments")
    .select(appointmentSelect)
    .eq("business_id", businessId)
    .in("status", LIVE_STATUSES)
    .gt("ends_at", now.toISOString())
    .order("starts_at")
    .limit(limit);
  if (error) throw toAppError(error);
  return data.map(toView);
}

/**
 * A business's appointments overlapping [from, to), soonest first. RLS decides the rows:
 * managers get everyone's, staff only their own.
 */
export async function listBusinessAppointments(
  db: Db,
  businessId: string,
  { from, to, includeCancelled = false }: { from: Date; to: Date; includeCancelled?: boolean },
): Promise<AppointmentView[]> {
  let query = db
    .from("appointments")
    .select(appointmentSelect)
    .eq("business_id", businessId)
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString())
    .order("starts_at")
    .limit(2000);
  if (!includeCancelled) query = query.neq("status", "cancelled");
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data.map(toView);
}

export type StatusChange = {
  id: number;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  reason: string | null;
  at: string;
};

/** Status history, oldest first (managers, the staff member, or the customer can read it). */
export async function getAppointmentHistory(db: Db, appointmentId: string): Promise<StatusChange[]> {
  const { data, error } = await db
    .from("appointment_status_history")
    .select("id, from_status, to_status, reason, created_at")
    .eq("appointment_id", appointmentId)
    .order("id");
  if (error) throw toAppError(error);
  return data.map((h) => ({
    id: h.id,
    fromStatus: h.from_status,
    toStatus: h.to_status,
    reason: h.reason,
    at: h.created_at,
  }));
}

/** One client's appointments at a business, latest first (managers). */
export async function listClientAppointments(db: Db, businessId: string, clientId: string): Promise<AppointmentView[]> {
  const { data, error } = await db
    .from("appointments")
    .select(appointmentSelect)
    .eq("business_id", businessId)
    .eq("client_id", clientId)
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throw toAppError(error);
  return data.map(toView);
}
