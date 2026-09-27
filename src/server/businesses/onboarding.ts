import "server-only";
import type { z } from "zod";
import type { Db } from "@/server/db/client";
import type { aboutSchema, contactSchema, createBusinessSchema, locationSchema } from "@/schemas/business";
import { AppError } from "@/lib/errors";
import { toAppError } from "./errors";

/**
 * Onboarding use-cases. Inputs are already validated by the shared Zod schemas at the
 * boundary (Server Action / API route); the database re-checks authorization (RLS +
 * SECURITY DEFINER functions) and invariants (constraints), so nothing here is trusted alone.
 */

export type ReadinessItem = "category" | "location" | "contact";

export async function createBusiness(
  db: Db,
  input: z.infer<typeof createBusinessSchema>,
  countryCode: string,
): Promise<{ id: string; slug: string }> {
  const { data, error } = await db
    .rpc("create_business", {
      p_name: input.name,
      p_kind: input.kind,
      p_category_id: input.categoryId,
      p_country_code: countryCode,
    })
    .single();
  if (error) throw toAppError(error);
  return { id: data.id, slug: data.slug };
}

export async function updateAbout(db: Db, businessId: string, input: z.infer<typeof aboutSchema>): Promise<void> {
  const { data, error } = await db
    .from("businesses")
    .update({ name: input.name, kind: input.kind, description: input.description })
    .eq("id", businessId)
    .select("id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("FORBIDDEN", "You don't have access to this business.");

  const category = await db.rpc("set_primary_category", { p_business_id: businessId, p_category_id: input.categoryId });
  if (category.error) throw toAppError(category.error);
}

export async function setBusinessSlug(db: Db, businessId: string, slug: string): Promise<string> {
  const { data, error } = await db.rpc("set_business_slug", { p_business_id: businessId, p_slug: slug });
  if (error) throw toAppError(error);
  return data;
}

export async function saveLocation(
  db: Db,
  businessId: string,
  input: z.infer<typeof locationSchema>,
  countryCode: string,
): Promise<void> {
  const row = {
    business_id: businessId,
    country_code: countryCode,
    city_id: input.cityId,
    area_id: input.cityId ? input.areaId : null,
    locality_text: input.cityId ? null : input.localityText,
    address_line: input.addressLine,
    landmark: input.landmark,
    directions: input.directions,
    lat: input.lat,
    lng: input.lng,
    is_primary: true,
  };

  const existing = await db
    .from("business_locations")
    .select("id")
    .eq("business_id", businessId)
    .eq("is_primary", true)
    .maybeSingle();
  if (existing.error) throw toAppError(existing.error);

  const result = existing.data
    ? await db.from("business_locations").update(row).eq("id", existing.data.id).select("id")
    : await db.from("business_locations").insert(row).select("id");
  if (result.error) {
    if (result.error.code === "23514") throw new AppError("VALIDATION", "That area isn't in the selected city.");
    throw toAppError(result.error);
  }
  if (result.data.length === 0) throw new AppError("FORBIDDEN", "You don't have access to this business.");
}

export async function saveContact(
  db: Db,
  businessId: string,
  input: z.infer<ReturnType<typeof contactSchema>>,
): Promise<void> {
  const { data, error } = await db
    .from("businesses")
    .update({ phone_e164: input.phone, whatsapp_e164: input.whatsapp, email: input.email })
    .eq("id", businessId)
    .select("id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("FORBIDDEN", "You don't have access to this business.");
}

export async function getPublishReadiness(db: Db, businessId: string): Promise<ReadinessItem[]> {
  const { data, error } = await db.rpc("business_publish_readiness", { p_business_id: businessId });
  if (error) throw toAppError(error);
  return data.filter((item): item is ReadinessItem => ["category", "location", "contact"].includes(item));
}

export async function publishBusiness(db: Db, businessId: string): Promise<void> {
  const { error } = await db.rpc("publish_business", { p_business_id: businessId });
  if (error) throw toAppError(error);
}

export async function unpublishBusiness(db: Db, businessId: string): Promise<void> {
  const { error } = await db.rpc("unpublish_business", { p_business_id: businessId });
  if (error) throw toAppError(error);
}
