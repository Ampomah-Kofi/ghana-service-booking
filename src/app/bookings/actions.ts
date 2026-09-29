"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cancelSchema } from "@/schemas/booking";
import { paymentMethodSchema } from "@/schemas/payments";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireUser } from "@/server/auth/session";
import { cancelMyAppointment } from "@/server/bookings/appointments";
import { createUserClient } from "@/server/db/supabase-server";
import { choosePaymentMethod } from "@/server/payments/service";

export async function cancelBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = cancelSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    await requireUser();
    await cancelMyAppointment(await createUserClient(), parsed.data.appointmentId, parsed.data.reason);
  } catch (error) {
    return formError(error, formData);
  }
  revalidatePath("/bookings");
  redirect(`/bookings/${parsed.data.appointmentId}?cancelled=1`);
}

/** The customer changes how they'll pay (information for the business; nothing is charged). */
export async function choosePaymentAction(
  appointmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = z.uuid().safeParse(appointmentId);
  const method = paymentMethodSchema.safeParse(formData.get("method"));
  if (!id.success) return { message: "Booking not found." };
  if (!method.success) return { message: "Choose how you'll pay." };
  try {
    await requireUser();
    await choosePaymentMethod(await createUserClient(), id.data, method.data);
  } catch (error) {
    return formError(error);
  }
  revalidatePath(`/bookings/${id.data}`);
  return { ok: true };
}
