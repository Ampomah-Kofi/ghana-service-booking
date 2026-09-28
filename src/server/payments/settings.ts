import "server-only";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import type { MomoNetwork, PaymentMethod } from "@/lib/payment-methods";
import type { paymentDetailsSchema } from "@/schemas/payments";
import { toAppError } from "@/server/businesses/errors";
import type { Db } from "@/server/db/client";
import { nullableArg } from "@/server/db/client";

/**
 * The business's own Mobile Money / bank details (ADR-0017). Owners and managers read them here;
 * customers see them only on their own booking (get_booking_payment_details). The owner edits.
 */
export type PaymentDetailsView = {
  momoNetwork: MomoNetwork | null;
  momoNumber: string | null;
  momoName: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
};

export async function getPaymentDetails(db: Db, businessId: string): Promise<PaymentDetailsView | null> {
  const { data, error } = await db
    .from("business_payment_details")
    .select("momo_network, momo_number_e164, momo_account_name, bank_name, bank_account_name, bank_account_number")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  return {
    momoNetwork: (data.momo_network as MomoNetwork | null) ?? null,
    momoNumber: data.momo_number_e164,
    momoName: data.momo_account_name,
    bankName: data.bank_name,
    bankAccountName: data.bank_account_name,
    bankAccountNumber: data.bank_account_number,
  };
}

/** Owner only (the database refuses everyone else). Empty on both sides removes the details. */
export async function setPaymentDetails(
  db: Db,
  businessId: string,
  input: z.infer<ReturnType<typeof paymentDetailsSchema>>,
): Promise<void> {
  const { error } = await db.rpc("set_payment_details", {
    p_business_id: businessId,
    p_momo_network: nullableArg(input.momo?.network ?? null),
    p_momo_number: nullableArg(input.momo?.phone ?? null),
    p_momo_account_name: nullableArg(input.momo?.name ?? null),
    p_bank_name: nullableArg(input.bank?.bankName ?? null),
    p_bank_account_name: nullableArg(input.bank?.accountName ?? null),
    p_bank_account_number: nullableArg(input.bank?.accountNumber ?? null),
  });
  if (error) throw toAppError(error);
}

/** Owners and managers choose which ways of paying they accept (shown on their page). */
export async function saveAcceptedMethods(db: Db, businessId: string, methods: PaymentMethod[]): Promise<void> {
  const { data, error } = await db
    .from("booking_rules")
    .update({ accepted_payment_methods: methods })
    .eq("business_id", businessId)
    .select("business_id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("FORBIDDEN", "You don't have access to this business.");
}
