"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bookingSchema, rescheduleSchema } from "@/schemas/booking";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireUser } from "@/server/auth/session";
import { bookAppointment, getAppointment, rescheduleMyAppointment } from "@/server/bookings/appointments";
import { getBusinessBySlug } from "@/server/businesses/queries";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
import { AppError } from "@/lib/errors";

export async function bookAction(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = bookingSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse({
    serviceId: formData.get("serviceId"),
    staff: formData.get("staff"),
    startsAt: formData.get("startsAt"),
    customerName: formData.get("customerName") ?? "",
    customerPhone: formData.get("customerPhone") ?? "",
    note: formData.get("note") ?? "",
    idempotencyKey: formData.get("idempotencyKey"),
    paymentMethod: formData.get("paymentMethod") ?? undefined,
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);

  let appointmentId: string;
  try {
    await requireUser();
    const db = await createUserClient();
    const business = await getBusinessBySlug(db, slug);
    if (!business || business.status !== "published")
      throw new AppError("NOT_FOUND", "This business isn't taking bookings.");
    const input = parsed.data;
    appointmentId = await bookAppointment(db, business, {
      businessId: business.id,
      serviceId: input.serviceId,
      staffId: input.staff === "any" ? null : input.staff,
      startsAt: new Date(input.startsAt),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
      paymentMethod: input.paymentMethod ?? null,
    });
  } catch (error) {
    return formError(error, formData);
  }
  revalidatePath("/bookings");
  redirect(`/bookings/${appointmentId}?booked=1`);
}

export async function rescheduleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = rescheduleSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    staff: formData.get("staff"),
    startsAt: formData.get("startsAt"),
  });
  if (!parsed.success) return { message: "Choose a new time." };

  let appointmentId: string;
  try {
    await requireUser();
    const db = await createUserClient();
    const appointment = await getAppointment(db, parsed.data.appointmentId);
    if (!appointment) throw new AppError("NOT_FOUND", "Booking not found.");
    appointmentId = await rescheduleMyAppointment(db, appointment, {
      staffId: parsed.data.staff === "any" ? null : parsed.data.staff,
      startsAt: new Date(parsed.data.startsAt),
    });
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/bookings");
  redirect(`/bookings/${appointmentId}?rescheduled=1`);
}
