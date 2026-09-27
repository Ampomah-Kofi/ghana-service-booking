"use server";

import { redirect } from "next/navigation";
import { createBusinessSchema } from "@/schemas/business";
import { fieldErrorsFrom, formError, type FormState } from "@/server/actions";
import { requireUser } from "@/server/auth/session";
import { createBusiness } from "@/server/businesses/onboarding";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";

export async function createBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createBusinessSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  let businessId: string;
  try {
    await requireUser();
    const created = await createBusiness(await createUserClient(), parsed.data, serverEnv().DEFAULT_COUNTRY_CODE);
    businessId = created.id;
  } catch (error) {
    return formError(error);
  }
  redirect(`/dashboard/${businessId}/setup/about`);
}
