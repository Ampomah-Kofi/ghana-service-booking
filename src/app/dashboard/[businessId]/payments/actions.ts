"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { acceptedMethodsSchema, paymentDetailsSchema, recordPaymentSchema, refundSchema } from "@/schemas/payments";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireBusinessMember, requireManagedBusiness } from "@/server/businesses/access";
import { serverEnv } from "@/server/env";
import { markPaymentRefunded, recordPayment } from "@/server/payments/service";
import { saveAcceptedMethods, setPaymentDetails } from "@/server/payments/settings";

/** Ways the business takes payment (owners and managers). Shown on the public page. */
export async function saveAcceptedMethodsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptedMethodsSchema.safeParse(formData.getAll("methods").map(String));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Choose at least one." };
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await saveAcceptedMethods(db, business.id, parsed.data);
    revalidatePath(`/dashboard/${business.id}/payments`);
    revalidatePath(`/business/${business.slug}`);
    return { ok: true, notice: "Saved." };
  } catch (error) {
    return formError(error, formData);
  }
}

/** The business's own Mobile Money / bank details, shown to its booked customers (owner only). */
export async function savePaymentDetailsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentDetailsSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse({
    momoNetwork: formData.get("momoNetwork") ?? undefined,
    momoNumber: formData.get("momoNumber") ?? undefined,
    momoName: formData.get("momoName") ?? undefined,
    bankName: formData.get("bankName") ?? undefined,
    bankAccountName: formData.get("bankAccountName") ?? undefined,
    bankAccountNumber: formData.get("bankAccountNumber") ?? undefined,
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await setPaymentDetails(db, business.id, parsed.data);
    revalidatePath(`/dashboard/${business.id}/payments`);
    return { ok: true, notice: "Payment details saved." };
  } catch (error) {
    return formError(error, formData);
  }
}

/** Money received at or around the visit. Any member may record it (the database checks). */
export async function recordPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { db, business } = await requireBusinessMember(formData.get("businessId"));
    const appointmentId = z.uuid().parse(formData.get("appointmentId"));
    const parsed = recordPaymentSchema(business.currency.minorUnit).safeParse({
      method: formData.get("method"),
      amount: formData.get("amount") ?? "",
      note: formData.get("note") ?? undefined,
    });
    if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
    await recordPayment(db, appointmentId, parsed.data.amount, parsed.data.method, parsed.data.note);
    revalidatePath(`/dashboard/${business.id}/appointments/${appointmentId}`);
    revalidatePath(`/dashboard/${business.id}/payments`);
    return { ok: true, notice: "Marked paid." };
  } catch (error) {
    return formError(error, formData);
  }
}

/** Owners and managers record money given back. */
export async function refundPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = refundSchema.safeParse({ note: formData.get("note") ?? "" });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    const paymentId = z.uuid().parse(formData.get("paymentId"));
    const appointmentId = z.uuid().parse(formData.get("appointmentId"));
    await markPaymentRefunded(db, paymentId, parsed.data.note);
    revalidatePath(`/dashboard/${business.id}/appointments/${appointmentId}`);
    revalidatePath(`/dashboard/${business.id}/payments`);
    return { ok: true, notice: "Marked refunded." };
  } catch (error) {
    return formError(error, formData);
  }
}
