import "server-only";
import type { Db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { toAppError } from "./errors";

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];

export type BusinessLocationView = {
  cityId: string | null;
  areaId: string | null;
  cityName: string | null;
  areaName: string | null;
  regionName: string | null;
  localityText: string | null;
  addressLine: string | null;
  landmark: string | null;
  directions: string | null;
  lat: number | null;
  lng: number | null;
};

export type BusinessPhotoView = {
  id: string;
  pathSmall: string;
  pathLarge: string;
  width: number | null;
  height: number | null;
};

export type BusinessView = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: BusinessRow["kind"];
  status: BusinessRow["status"];
  publishedAt: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  logoPath: string | null;
  category: { id: string; name: string; slug: string } | null;
  location: BusinessLocationView | null;
  photos: BusinessPhotoView[];
};

const businessSelect = `
  id, slug, name, description, kind, status, published_at, phone_e164, whatsapp_e164, email, logo_path,
  business_categories ( is_primary, categories ( id, name, slug ) ),
  business_locations ( is_primary, city_id, area_id, locality_text, address_line, landmark, directions, lat, lng,
                       cities ( name, regions ( name ) ), areas ( name ) ),
  business_photos ( id, path_small, path_large, width, height, sort_order, created_at )
` as const;

/**
 * One business with its profile. RLS decides visibility: the public sees published
 * businesses; members also see their drafts. Returns null when not visible.
 */
async function loadBusiness(db: Db, column: "id" | "slug", value: string): Promise<BusinessView | null> {
  const { data, error } = await db
    .from("businesses")
    .select(businessSelect)
    .eq(column, value)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // not a UUID
    throw toAppError(error);
  }
  if (!data) return null;

  const primaryCategory = data.business_categories.find((c) => c.is_primary)?.categories ?? null;
  const loc = data.business_locations.find((l) => l.is_primary) ?? null;

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    kind: data.kind,
    status: data.status,
    publishedAt: data.published_at,
    phone: data.phone_e164,
    whatsapp: data.whatsapp_e164,
    email: data.email,
    logoPath: data.logo_path,
    category: primaryCategory,
    location: loc
      ? {
          cityId: loc.city_id,
          areaId: loc.area_id,
          cityName: loc.cities?.name ?? null,
          regionName: loc.cities?.regions?.name ?? null,
          areaName: loc.areas?.name ?? null,
          localityText: loc.locality_text,
          addressLine: loc.address_line,
          landmark: loc.landmark,
          directions: loc.directions,
          lat: loc.lat,
          lng: loc.lng,
        }
      : null,
    photos: [...data.business_photos]
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
      .map((p) => ({ id: p.id, pathSmall: p.path_small, pathLarge: p.path_large, width: p.width, height: p.height })),
  };
}

export function getBusinessById(db: Db, businessId: string): Promise<BusinessView | null> {
  return loadBusiness(db, "id", businessId);
}

export function getBusinessBySlug(db: Db, slug: string): Promise<BusinessView | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return Promise.resolve(null);
  return loadBusiness(db, "slug", slug);
}

/** "East Legon, Accra" / "Nkawkaw". */
export function formatPlace(location: BusinessLocationView | null): string | null {
  if (!location) return null;
  const parts = [location.areaName, location.cityName ?? location.localityText].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
