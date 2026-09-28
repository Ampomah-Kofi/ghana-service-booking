"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { manualPaymentSchema, payoutAccountSchema, refundSchema } from "@/schemas/payments";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireBusinessMember, requireManagedBusiness } from "@/server/businesses/access";
import { serverEnv } from "@/server/env";
import { recordManualPayment, requestRefund } from "@/server/payments/service";
import { savePaymentRules, setPayoutAccount } from "@/server/payments/settings";

/** Where the money goes (owner only; the database refuses managers). */
export async function savePayoutAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = payoutAccountSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse({
    method: formData.get("method"),
    accountName: formData.get("accountName") ?? "",
    network: formData.get("network") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    bankName: formData.get("bankName") ?? undefined,
    accountNumber: formData.get("accountNumber") ?? undefined,
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await setPayoutAccount(db, business.id, parsed.data);
    revalidatePath(`/dashboard/${business.id}/payments`);
    return { ok: true, notice: "Payout details saved." };
  } catch (error) {
    return formError(error, formData);
  }
}

export async function savePaymentRulesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await savePaymentRules(db, business.id, {
      collectDepositsOnline: formData.get("collectDepositsOnline") === "on",
      allowFullPaymentOnline: formData.get("allowFullPaymentOnline") === "on",
      refundDepositOnNoShow: formData.get("refundDepositOnNoShow") === "on",
    });
    revalidatePath(`/dashboard/${business.id}/payments`);
    revalidatePath(`/business/${business.slug}`);
    return { ok: true, notice: "Payment settings saved." };
  } catch (error) {
    return formError(error, formData);
  }
}

/** Cash or Mobile Money handed over at the visit. Any member may record it (the database checks). */
export async function recordPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { db, business } = await requireBusinessMember(formData.get("businessId"));
    const appointmentId = z.uuid().parse(formData.get("appointmentId"));
    const parsed = manualPaymentSchema(business.currency.minorUnit).safeParse({
      method: formData.get("method"),
      amount: formData.get("amount") ?? "",
      note: formData.get("note") ?? undefined,
    });
    if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
    await recordManualPayment(db, appointmentId, parsed.data.amount, parsed.data.method, parsed.data.note);
    revalidatePath(`/dashboard/${business.id}/appointments/${appointmentId}`);
    revalidatePath(`/dashboard/${business.id}/payments`);
    return { ok: true, notice: "Payment recorded." };
  } catch (error) {
    return formError(error, formData);
  }
}

/** Owners and managers send money back (the job calls the provider, or it's marked done for cash). */
export async function refundPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = refundSchema.safeParse({ reason: formData.get("reason") ?? "" });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    const paymentId = z.uuid().parse(formData.get("paymentId"));
    const appointmentId = z.uuid().parse(formData.get("appointmentId"));
    await requestRefund(db, paymentId, parsed.data.reason);
    revalidatePath(`/dashboard/${business.id}/appointments/${appointmentId}`);
    revalidatePath(`/dashboard/${business.id}/payments`);
    return { ok: true, notice: "Refund started." };
  } catch (error) {
    return formError(error, formData);
  }
}
