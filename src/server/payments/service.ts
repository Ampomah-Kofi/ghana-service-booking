import "server-only";
import { AppError } from "@/lib/errors";
import { toAppError } from "@/server/businesses/errors";
import type { Db } from "@/server/db/client";
import { nullableArg } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { getPaymentProvider } from "./index";
import type { ChargeNext, MomoNetwork, PaymentMethod } from "./provider";

export type PaymentKind = Database["public"]["Enums"]["payment_kind"];
export type PaymentAttemptStatus = Database["public"]["Enums"]["payment_attempt_status"];

export type PaymentView = {
  id: string;
  appointmentId: string;
  kind: PaymentKind;
  method: Database["public"]["Enums"]["payment_method"];
  provider: string;
  status: PaymentAttemptStatus;
  amountMinor: number;
  currency: string;
  network: MomoNetwork | null;
  failureReason: string | null;
  note: string | null;
  /** Our merchant reference for the attempt (shown to the payer and the business for support). */
  reference: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
};

const select =
  "id, appointment_id, kind, method, provider, status, amount_minor, currency_code, momo_network, failure_reason, note, provider_reference, paid_at, refunded_at, created_at";

type Row = {
  id: string;
  appointment_id: string;
  kind: PaymentKind;
  method: PaymentView["method"];
  provider: string;
  status: PaymentAttemptStatus;
  amount_minor: number;
  currency_code: string;
  momo_network: string | null;
  failure_reason: string | null;
  note: string | null;
  provider_reference: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

const toView = (r: Row): PaymentView => ({
  id: r.id,
  appointmentId: r.appointment_id,
  kind: r.kind,
  method: r.method,
  provider: r.provider,
  status: r.status,
  amountMinor: r.amount_minor,
  currency: r.currency_code,
  network: (r.momo_network as MomoNetwork | null) ?? null,
  failureReason: r.failure_reason,
  note: r.note,
  reference: r.provider_reference,
  paidAt: r.paid_at,
  refundedAt: r.refunded_at,
  createdAt: r.created_at,
});

/** Payments on one booking the caller may see (RLS: the customer, owners/managers, admins). */
export async function listAppointmentPayments(db: Db, appointmentId: string): Promise<PaymentView[]> {
  const { data, error } = await db
    .from("payments")
    .select(select)
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: true });
  if (error) throw toAppError(error);
  return data.map(toView);
}

export type BusinessPaymentRow = PaymentView & { customerName: string; serviceName: string; startsAt: string };

/** A business's payments in a time range, newest first (owners and managers; RLS). */
export async function listBusinessPayments(
  db: Db,
  businessId: string,
  since: Date,
  limit = 200,
): Promise<BusinessPaymentRow[]> {
  const { data, error } = await db
    .from("payments")
    .select(`${select}, appointments ( customer_name, service_name, starts_at )`)
    .eq("business_id", businessId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return data.map((r) => ({
    ...toView(r),
    customerName: r.appointments?.customer_name ?? "",
    serviceName: r.appointments?.service_name ?? "",
    startsAt: r.appointments?.starts_at ?? r.created_at,
  }));
}

export type StartPaymentInput = {
  appointmentId: string;
  kind: PaymentKind;
  method: PaymentMethod;
  phoneE164?: string;
  network?: MomoNetwork;
  customerName: string;
  description: string;
  returnUrl: string;
};

/**
 * The customer starts paying, entirely with their own session: the database records the attempt
 * (checks the owner, the hold and the amount) and gives it a unique reference; the provider is then
 * asked for a charge under that reference. If the provider refuses, the attempt is closed.
 */
export async function startPayment(
  db: Db,
  input: StartPaymentInput,
): Promise<{ paymentId: string; amountMinor: number; currency: string; next: ChargeNext }> {
  const provider = getPaymentProvider();
  if (!provider) throw new AppError("CONFLICT", "Online payments aren't available yet. Pay at the visit.");
  const { data, error } = await db.rpc("start_payment", {
    p_appointment_id: input.appointmentId,
    p_kind: input.kind,
    p_method: input.method,
    p_provider: provider.id,
    p_phone: nullableArg(input.phoneE164 ?? null),
    p_network: nullableArg(input.network ?? null),
  });
  if (error) throw toAppError(error);
  const row = data[0];
  if (!row) throw new AppError("INTERNAL", "Something went wrong. Please try again.");
  try {
    const charge = await provider.createCharge({
      paymentId: row.payment_id,
      reference: row.idempotency_key,
      amountMinor: row.amount_minor,
      currency: row.currency_code,
      method: input.method,
      customer: { name: input.customerName, phoneE164: input.phoneE164, network: input.network },
      description: input.description,
      returnUrl: input.returnUrl,
    });
    return { paymentId: row.payment_id, amountMinor: row.amount_minor, currency: row.currency_code, next: charge.next };
  } catch (e) {
    console.error("[payments] createCharge failed", e);
    await db.rpc("abandon_payment", {
      p_payment_id: row.payment_id,
      p_reason: "The payment service didn't respond",
    });
    throw new AppError("CONFLICT", "The payment service didn't respond. Please try again.");
  }
}

export async function recordManualPayment(
  db: Db,
  appointmentId: string,
  amountMinor: number,
  method: "cash" | "mobile_money",
  note: string | null,
): Promise<void> {
  const { error } = await db.rpc("record_manual_payment", {
    p_appointment_id: appointmentId,
    p_amount_minor: amountMinor,
    p_method: method,
    p_note: nullableArg(note),
  });
  if (error) throw toAppError(error);
}

export async function requestRefund(db: Db, paymentId: string, reason: string): Promise<void> {
  const { error } = await db.rpc("request_refund", { p_payment_id: paymentId, p_reason: reason });
  if (error) throw toAppError(error);
}
