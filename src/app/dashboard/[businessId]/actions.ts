"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nextStepHref } from "@/components/ui/step-header";
import { AppError } from "@/lib/errors";
import { aboutSchema, contactSchema, locationSchema, slugSchema } from "@/schemas/business";
import { fieldErrorsFrom, formError, formValues, type FormState } from "@/server/actions";
import { requireManagedBusiness } from "@/server/businesses/access";
import { addPortfolioPhoto, deletePortfolioPhoto, removeLogo, setLogo } from "@/server/businesses/media";
import {
  publishBusiness,
  saveContact,
  saveLocation,
  setBusinessSlug,
  unpublishBusiness,
  updateAbout,
} from "@/server/businesses/onboarding";
import { serverEnv } from "@/server/env";

/**
 * Every action re-checks access (requireManagedBusiness) and the database
 * re-checks again via RLS, so a tampered businessId gets nowhere.
 */

function refresh(businessId: string, slug?: string) {
  revalidatePath(`/dashboard/${businessId}`, "layout");
  if (slug) revalidatePath(`/business/${slug}`);
}

export async function saveAboutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = aboutSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  let businessId: string;
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await updateAbout(db, business.id, parsed.data);
    refresh(business.id, business.slug);
    businessId = business.id;
  } catch (error) {
    return formError(error, formData);
  }
  redirect(nextStepHref(businessId, "about"));
}

export async function saveSlugAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ slug: slugSchema }).safeParse({ slug: formData.get("slug") });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    const slug = await setBusinessSlug(db, business.id, parsed.data.slug);
    refresh(business.id);
    return { ok: true, notice: `Your page is now at /business/${slug}` };
  } catch (error) {
    if (error instanceof AppError && (error.code === "CONFLICT" || error.code === "VALIDATION")) {
      return { fieldErrors: { slug: error.message }, values: formValues(formData) };
    }
    return formError(error, formData);
  }
}

export async function saveLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = locationSchema.safeParse({
    cityChoice: formData.get("cityId") ?? "",
    localityText: formData.get("localityText") ?? "",
    areaId: formData.get("areaId") ?? "",
    addressLine: formData.get("addressLine") ?? "",
    landmark: formData.get("landmark") ?? "",
    directions: formData.get("directions") ?? "",
    lat: formData.get("lat") || null,
    lng: formData.get("lng") || null,
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  let businessId: string;
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await saveLocation(db, business.id, parsed.data, serverEnv().DEFAULT_COUNTRY_CODE);
    refresh(business.id, business.slug);
    businessId = business.id;
  } catch (error) {
    return formError(error, formData);
  }
  redirect(nextStepHref(businessId, "location"));
}

export async function saveContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse({
    phone: formData.get("phone") ?? "",
    whatsappSameAsPhone: formData.get("whatsappSameAsPhone") ?? undefined,
    whatsapp: formData.get("whatsapp") ?? "",
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  let businessId: string;
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await saveContact(db, business.id, parsed.data);
    refresh(business.id, business.slug);
    businessId = business.id;
  } catch (error) {
    return formError(error, formData);
  }
  redirect(nextStepHref(businessId, "contact"));
}

function fileFrom(formData: FormData, name: string): File {
  const value = formData.get(name);
  if (!(value instanceof File)) throw new AppError("VALIDATION", "Choose a photo to upload.");
  return value;
}

export async function uploadLogoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await setLogo(db, business.id, fileFrom(formData, "logo"));
    refresh(business.id, business.slug);
    return { ok: true, notice: "Logo updated." };
  } catch (error) {
    return formError(error, formData);
  }
}

export async function removeLogoAction(formData: FormData): Promise<void> {
  const { db, business } = await requireManagedBusiness(formData.get("businessId"));
  await removeLogo(db, business.id);
  refresh(business.id, business.slug);
}

export async function addPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    const dims = z
      .object({ width: z.coerce.number().int(), height: z.coerce.number().int() })
      .safeParse({ width: formData.get("width"), height: formData.get("height") });
    if (!dims.success) throw new AppError("VALIDATION", "That photo couldn't be read. Please try another one.");
    await addPortfolioPhoto(db, business.id, {
      small: fileFrom(formData, "small"),
      large: fileFrom(formData, "large"),
      ...dims.data,
    });
    refresh(business.id, business.slug);
    return { ok: true, notice: "Photo added." };
  } catch (error) {
    return formError(error, formData);
  }
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  const { db, business } = await requireManagedBusiness(formData.get("businessId"));
  const photoId = z.uuid().parse(formData.get("photoId"));
  await deletePortfolioPhoto(db, business.id, photoId);
  refresh(business.id, business.slug);
}

export async function publishAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await publishBusiness(db, business.id);
    refresh(business.id, business.slug);
    return { ok: true, notice: "Your page is live. Share it with your customers!" };
  } catch (error) {
    return formError(error, formData);
  }
}

export async function unpublishAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { db, business } = await requireManagedBusiness(formData.get("businessId"));
    await unpublishBusiness(db, business.id);
    refresh(business.id, business.slug);
    return { ok: true, notice: "Your page is hidden. Only your team can see it." };
  } catch (error) {
    return formError(error, formData);
  }
}
