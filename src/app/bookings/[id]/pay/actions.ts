"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/public-env";
import { startPaymentSchema } from "@/schemas/payments";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireUser } from "@/server/auth/session";
import { getAppointment } from "@/server/bookings/appointments";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
import { startPayment } from "@/server/payments/service";
import { AppError } from "@/lib/errors";

/** The customer pays online (Phase 9): the database checks it's theirs and what's due. */
export async function payAction(appointmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(appointmentId);
  if (!id.success) return { message: "Booking not found." };
  const parsed = startPaymentSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse({
    method: formData.get("method"),
    network: formData.get("network") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    kind: formData.get("kind") ?? undefined,
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);

  let destination: string;
  try {
    await requireUser();
    const db = await createUserClient();
    const appointment = await getAppointment(db, id.data);
    if (!appointment) throw new AppError("NOT_FOUND", "Booking not found.");
    const input = parsed.data;
    const site = publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    const result = await startPayment(db, {
      appointmentId: appointment.id,
      kind: input.kind,
      method: input.method,
      phoneE164: input.method === "mobile_money" ? input.phone : undefined,
      network: input.method === "mobile_money" ? input.network : undefined,
      customerName: appointment.customerName,
      description: `${input.kind === "deposit" ? "Deposit" : "Payment"} for ${appointment.serviceName} at ${appointment.business.name ?? "the business"}`,
      returnUrl: `${site}/bookings/${appointment.id}`,
    });
    destination =
      result.next.type === "redirect"
        ? result.next.url
        : `/bookings/${appointment.id}/pay?waiting=1&kind=${input.kind}`;
  } catch (error) {
    return formError(error, formData);
  }
  redirect(destination);
}
