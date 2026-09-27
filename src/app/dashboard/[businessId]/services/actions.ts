"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serviceSchema } from "@/schemas/catalog";
import { fieldErrorsFrom, formError, formValues, type FormState } from "@/server/actions";
import { requireManagedBusiness } from "@/server/businesses/access";
import { archiveService, createService, moveService, updateService } from "@/server/businesses/catalog";
import { listStaff } from "@/server/businesses/team";

function returnPath(businessId: string, returnTo: FormDataEntryValue | null): string {
  return returnTo === "setup" ? `/dashboard/${businessId}/setup/services` : `/dashboard/${businessId}/services`;
}

export async function saveServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let destination: string;
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    // Solo businesses don't pick staff: the owner does every service.
    const staffIds =
      business.kind === "solo"
        ? (await listStaff(db, business.id, { withInvites: false })).map((s) => s.id)
        : formData.getAll("staffIds").map(String);
    const parsed = serviceSchema(business.currency.minorUnit).safeParse({
      name: formData.get("name"),
      description: formData.get("description") ?? "",
      price: formData.get("price") ?? "",
      priceType: formData.get("priceType"),
      durationMinutes: formData.get("durationMinutes"),
      deposit: formData.get("deposit") ?? "",
      isActive: formData.get("isActive"),
      staffIds,
    });
    if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
    if (business.kind === "team" && parsed.data.staffIds.length === 0 && parsed.data.isActive) {
      return {
        fieldErrors: { staffIds: "Choose who does this service, or hide it for now." },
        values: formValues(formData),
      };
    }

    const serviceId = z.uuid().safeParse(formData.get("serviceId"));
    if (serviceId.success) await updateService(db, business.id, serviceId.data, parsed.data);
    else await createService(db, { id: business.id, currencyCode: business.currency.code }, parsed.data);

    revalidatePath(`/dashboard/${business.id}`, "layout");
    revalidatePath(`/business/${business.slug}`);
    destination = returnPath(business.id, formData.get("returnTo"));
  } catch (error) {
    return formError(error, formData);
  }
  redirect(destination);
}

export async function archiveServiceAction(formData: FormData): Promise<void> {
  const { db, business } = await requireManagedBusiness(formData.get("businessId"));
  await archiveService(db, business.id, z.uuid().parse(formData.get("serviceId")));
  revalidatePath(`/dashboard/${business.id}`, "layout");
  revalidatePath(`/business/${business.slug}`);
  redirect(returnPath(business.id, formData.get("returnTo")));
}

export async function moveServiceAction(formData: FormData): Promise<void> {
  const { db, business } = await requireManagedBusiness(formData.get("businessId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  await moveService(db, business.id, z.uuid().parse(formData.get("serviceId")), direction);
  revalidatePath(`/dashboard/${business.id}`, "layout");
  revalidatePath(`/business/${business.slug}`);
}
