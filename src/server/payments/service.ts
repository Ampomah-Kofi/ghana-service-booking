import "server-only";
import { AppError } from "@/lib/errors";
import type { PaymentMethod } from "@/lib/payment-methods";
import { toAppError } from "@/server/businesses/errors";
import type { Db } from "@/server/db/client";
import { nullableArg } from "@/server/db/client";

/**
 * Payments are a record of money the business says it received (ADR-0017). Nothing here moves
 * money: the customer pays the business directly (cash, Mobile Money, bank, card at the shop).
 */
export type PaymentView = {
  id: string;
  appointmentId: string;
  method: PaymentMethod;
  amountMinor: number;
  currency: string;
  note: string | null;
  paidAt: string;
  refundedAt: string | null;
  refundNote: string | null;
};

const select = "id, appointment_id, method, amount_minor, currency_code, note, paid_at, refunded_at, refund_note";

type Row = {
  id: string;
  appointment_id: string;
  method: PaymentMethod;
  amount_minor: number;
  currency_code: string;
  note: string | null;
  paid_at: string;
  refunded_at: string | null;
  refund_note: string | null;
};

const toView = (r: Row): PaymentView => ({
  id: r.id,
  appointmentId: r.appointment_id,
  method: r.method,
  amountMinor: r.amount_minor,
  currency: r.currency_code,
  note: r.note,
  paidAt: r.paid_at,
  refundedAt: r.refunded_at,
  refundNote: r.refund_note,
});

/** What has been paid (not refunded) across a booking's payments. */
export function paidTotal(payments: Pick<PaymentView, "amountMinor" | "refundedAt">[]): number {
  return payments.filter((p) => p.refundedAt === null).reduce((sum, p) => sum + p.amountMinor, 0);
}

/** Payments recorded on one booking that the caller may see (RLS: its customer, owners/managers, admins). */
export async function listAppointmentPayments(db: Db, appointmentId: string): Promise<PaymentView[]> {
  const { data, error } = await db
    .from("payments")
    .select(select)
    .eq("appointment_id", appointmentId)
    .order("paid_at", { ascending: true });
  if (error) throw toAppError(error);
  return data.map(toView);
}

export type BusinessPaymentRow = PaymentView & { customerName: string; serviceName: string };

/** A business's recorded payments since a date, newest first (owners and managers; RLS). */
export async function listBusinessPayments(
  db: Db,
  businessId: string,
  since: Date,
  limit = 200,
): Promise<BusinessPaymentRow[]> {
  const { data, error } = await db
    .from("payments")
    .select(`${select}, appointments ( customer_name, service_name )`)
    .eq("business_id", businessId)
    .gte("paid_at", since.toISOString())
    .order("paid_at", { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return data.map((r) => ({
    ...toView(r),
    customerName: r.appointments?.customer_name ?? "",
    serviceName: r.appointments?.service_name ?? "",
  }));
}

/** Any member of the business marks money received. The database caps it at the price. */
export async function recordPayment(
  db: Db,
  appointmentId: string,
  amountMinor: number,
  method: PaymentMethod,
  note: string | null,
): Promise<string> {
  const { data, error } = await db.rpc("record_payment", {
    p_appointment_id: appointmentId,
    p_amount_minor: amountMinor,
    p_method: method,
    p_note: nullableArg(note),
  });
  if (error) throw toAppError(error);
  return data;
}

/** Owners and managers record money given back. */
export async function markPaymentRefunded(db: Db, paymentId: string, note: string): Promise<void> {
  const { error } = await db.rpc("mark_payment_refunded", { p_payment_id: paymentId, p_note: note });
  if (error) throw toAppError(error);
}

/** The customer says how they'll pay (information only; one of the business's accepted methods). */
export async function choosePaymentMethod(db: Db, appointmentId: string, method: PaymentMethod): Promise<void> {
  const { error } = await db.rpc("choose_payment_method", { p_appointment_id: appointmentId, p_method: method });
  if (error) throw toAppError(error);
}

export type BookingPaymentDetails = {
  momo: { network: string | null; number: string; name: string | null } | null;
  bank: { bankName: string | null; accountName: string | null; accountNumber: string } | null;
};

/**
 * The business's own Mobile Money / bank details for this booking's customer (or the business).
 * Only the chosen method's details come back; null when the business hasn't added any.
 */
export async function getBookingPaymentDetails(db: Db, appointmentId: string): Promise<BookingPaymentDetails | null> {
  const { data, error } = await db.rpc("get_booking_payment_details", { p_appointment_id: appointmentId });
  if (error) {
    if (error.code === "BZ404") return null;
    throw toAppError(error);
  }
  const row = data[0];
  if (!row) return null;
  const details: BookingPaymentDetails = {
    momo: row.momo_number_e164
      ? { network: row.momo_network, number: row.momo_number_e164, name: row.momo_account_name }
      : null,
    bank: row.bank_account_number
      ? { bankName: row.bank_name, accountName: row.bank_account_name, accountNumber: row.bank_account_number }
      : null,
  };
  return details.momo || details.bank ? details : null;
}

export function assertAccepted(accepted: PaymentMethod[], method: PaymentMethod): void {
  if (!accepted.includes(method)) throw new AppError("VALIDATION", "The business doesn't take that way of paying.");
}
