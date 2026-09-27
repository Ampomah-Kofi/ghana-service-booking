"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelSchema } from "@/schemas/booking";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireUser } from "@/server/auth/session";
import { cancelMyAppointment } from "@/server/bookings/appointments";
import { createUserClient } from "@/server/db/supabase-server";

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
