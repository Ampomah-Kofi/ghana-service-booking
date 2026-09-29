"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientSchema } from "@/schemas/booking";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireManagedBusiness } from "@/server/businesses/access";
import { saveClient } from "@/server/clients/clients";
import { serverEnv } from "@/server/env";

export async function saveClientAction(businessId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = clientSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse({
    clientId: formData.get("clientId") ?? "",
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  let id: string;
  try {
    const { db, business } = await requireManagedBusiness(businessId);
    id = await saveClient(db, business.id, { id: parsed.data.clientId, ...parsed.data });
    revalidatePath(`/dashboard/${business.id}/clients`, "layout");
  } catch (error) {
    return formError(error, formData);
  }
  if (parsed.data.clientId) return { ok: true, notice: "Saved." };
  redirect(`/dashboard/${businessId}/clients/${id}`);
}
