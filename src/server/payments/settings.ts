import "server-only";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { toAppError } from "@/server/businesses/errors";
import type { Db } from "@/server/db/client";
import { nullableArg } from "@/server/db/client";
import type { MomoNetworkKey, payoutAccountSchema } from "@/schemas/payments";

/**
 * Where a business gets paid, as the owner sees it: enough to recognise the account, never the whole
 * number (ADR-0017). Only owners and admins can read the row at all (RLS); managers get null.
 */
export type PayoutAccountView = {
  method: "mobile_money" | "bank";
  accountName: string;
  network: MomoNetworkKey | null;
  bankName: string | null;
  /** Last 4 digits of the Mobile Money or bank account number. */
  last4: string;
  /** "verified" once the payment provider has registered the account. */
  status: "unverified" | "verified";
  updatedAt: string;
};

export async function getPayoutAccount(db: Db, businessId: string): Promise<PayoutAccountView | null> {
  const { data, error } = await db
    .from("business_payout_accounts")
    .select("method, account_name, momo_network, momo_number_e164, bank_name, bank_account_number, status, updated_at")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  const number = data.method === "mobile_money" ? data.momo_number_e164 : data.bank_account_number;
  return {
    method: data.method,
    accountName: data.account_name,
    network: (data.momo_network as MomoNetworkKey | null) ?? null,
    bankName: data.bank_name,
    last4: (number ?? "").slice(-4),
    status: data.status === "verified" ? "verified" : "unverified",
    updatedAt: data.updated_at,
  };
}

/** Owner only (the database refuses everyone else). New details go back to "unverified". */
export async function setPayoutAccount(
  db: Db,
  businessId: string,
  input: z.infer<ReturnType<typeof payoutAccountSchema>>,
): Promise<void> {
  const { error } = await db.rpc("set_payout_account", {
    p_business_id: businessId,
    p_method: input.method,
    p_account_name: input.accountName,
    p_momo_network: nullableArg(input.method === "mobile_money" ? input.network : null),
    p_momo_number: nullableArg(input.method === "mobile_money" ? input.phone : null),
    p_bank_name: nullableArg(input.method === "bank" ? input.bankName : null),
    p_bank_account_number: nullableArg(input.method === "bank" ? input.accountNumber : null),
  });
  if (error) throw toAppError(error);
}

export type PaymentRules = {
  collectDepositsOnline: boolean;
  allowFullPaymentOnline: boolean;
  refundDepositOnNoShow: boolean;
};

/** Owners and managers. Turning online payments on without payout details fails with BZ409. */
export async function savePaymentRules(db: Db, businessId: string, rules: PaymentRules): Promise<void> {
  const { data, error } = await db
    .from("booking_rules")
    .update({
      collect_deposits_online: rules.collectDepositsOnline,
      allow_full_payment_online: rules.allowFullPaymentOnline,
      refund_deposit_on_no_show: rules.refundDepositOnNoShow,
    })
    .eq("business_id", businessId)
    .select("business_id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("FORBIDDEN", "You don't have access to this business.");
}
