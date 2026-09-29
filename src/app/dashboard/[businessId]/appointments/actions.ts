"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localToInstant } from "@/lib/availability";
import { AppError } from "@/lib/errors";
import { parseMoneyInput } from "@/lib/money";
import { manualAppointmentSchema, moveSchema, statusChangeSchema } from "@/schemas/booking";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireBusinessMember } from "@/server/businesses/access";
import { addManualAppointment, moveAppointment, setAppointmentStatus } from "@/server/bookings/manage";
import { serverEnv } from "@/server/env";

function refresh(businessId: string) {
  revalidatePath(`/dashboard/${businessId}`, "layout");
  revalidatePath("/bookings", "layout");
}

export async function statusAction(businessId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = statusChangeSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status"),
    reason: formData.get("reason") ?? "",
    finalPrice: formData.get("finalPrice") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const { db, business } = await requireBusinessMember(businessId);
    let finalPriceMinor: number | null = null;
    if (parsed.data.finalPrice) {
      finalPriceMinor = parseMoneyInput(parsed.data.finalPrice, business.currency.minorUnit);
      if (finalPriceMinor === null) return { fieldErrors: { finalPrice: "Enter an amount like 80 or 80.50." } };
    }
    await setAppointmentStatus(db, parsed.data.appointmentId, parsed.data.status, {
      reason: parsed.data.reason,
      finalPriceMinor,
    });
    refresh(business.id);
    return { ok: true };
  } catch (error) {
    return formError(error, formData);
  }
}

export async function addAppointmentAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = manualAppointmentSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse({
    walkIn: formData.get("walkIn") ?? "0",
    serviceId: formData.get("serviceId") ?? "",
    staffId: formData.get("staffId") ?? "",
    date: formData.get("date") || undefined,
    time: formData.get("time") || undefined,
    clientId: formData.get("clientId") ?? "",
    clientName: formData.get("clientName") ?? "",
    clientPhone: formData.get("clientPhone") ?? "",
    note: formData.get("note") ?? "",
    allowOutsideHours: formData.get("allowOutsideHours"),
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  const input = parsed.data;
  let id: string;
  let date: string;
  try {
    const { db, business } = await requireBusinessMember(businessId);
    const startsAt =
      input.walkIn || !input.date || !input.time
        ? new Date(Math.floor(Date.now() / 60_000) * 60_000)
        : localToInstant(
            input.date,
            Number(input.time.slice(0, 2)) * 60 + Number(input.time.slice(3)),
            business.timezone,
          );
    if (Number.isNaN(startsAt.getTime())) throw new AppError("VALIDATION", "Choose a valid date and time.");
    id = await addManualAppointment(db, business.id, {
      serviceId: input.serviceId,
      staffId: input.staffId,
      startsAt,
      client: input.clientId ? { id: input.clientId } : { name: input.clientName ?? "", phone: input.clientPhone },
      note: input.note,
      walkIn: input.walkIn,
      // A walk-in is happening now, so working hours don't apply; overlaps are still refused.
      allowOutsideHours: input.walkIn || input.allowOutsideHours,
    });
    date = input.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: business.timezone }).format(startsAt);
    refresh(business.id);
  } catch (error) {
    return formError(error, formData);
  }
  redirect(`/dashboard/${businessId}/calendar?date=${date}&added=${id}`);
}

export async function moveAction(businessId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = moveSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    staffId: formData.get("staffId") ?? "",
    date: formData.get("date") ?? "",
    time: formData.get("time") ?? "",
    allowOutsideHours: formData.get("allowOutsideHours"),
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  const input = parsed.data;
  try {
    const { db, business } = await requireBusinessMember(businessId);
    const startsAt = localToInstant(
      input.date,
      Number(input.time.slice(0, 2)) * 60 + Number(input.time.slice(3)),
      business.timezone,
    );
    await moveAppointment(db, input.appointmentId, {
      staffId: input.staffId,
      startsAt,
      allowOutsideHours: input.allowOutsideHours,
    });
    refresh(business.id);
  } catch (error) {
    return formError(error, formData);
  }
  redirect(`/dashboard/${businessId}/appointments/${input.appointmentId}?moved=1`);
}
