import "server-only";
import type { SocialLinks } from "@/lib/social";
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
  /** The service this photo shows, if the business tagged one (Phase 7). */
  serviceId: string | null;
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
  /** Instagram/TikTok/X handles (no "@") and Facebook/YouTube/website https URLs. */
  social: SocialLinks;
  /** New bookings also go by SMS to the business phone (Phase 8). */
  notifyNewBookingSms: boolean;
  email: string | null;
  logoPath: string | null;
  category: { id: string; name: string; slug: string } | null;
  currency: { code: string; symbol: string; minorUnit: number };
  timezone: string;
  location: BusinessLocationView | null;
  photos: BusinessPhotoView[];
};

const businessSelect = `
  id, slug, name, description, kind, status, published_at, phone_e164, whatsapp_e164, email, logo_path, timezone,
  instagram_handle, tiktok_handle, x_handle, facebook_url, youtube_url, website_url, notify_new_booking_sms,
  currencies ( code, symbol, minor_unit ),
  business_categories ( is_primary, categories ( id, name, slug ) ),
  business_locations ( is_primary, city_id, area_id, locality_text, address_line, landmark, directions, lat, lng,
                       cities ( name, regions ( name ) ), areas ( name ) ),
  business_photos ( id, path_small, path_large, width, height, sort_order, created_at, service_id )
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
    social: {
      instagram: data.instagram_handle,
      tiktok: data.tiktok_handle,
      x: data.x_handle,
      facebook: data.facebook_url,
      youtube: data.youtube_url,
      website: data.website_url,
    },
    notifyNewBookingSms: data.notify_new_booking_sms,
    logoPath: data.logo_path,
    category: primaryCategory,
    currency: { code: data.currencies.code, symbol: data.currencies.symbol, minorUnit: data.currencies.minor_unit },
    timezone: data.timezone,
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
      .map((p) => ({
        id: p.id,
        pathSmall: p.path_small,
        pathLarge: p.path_large,
        width: p.width,
        height: p.height,
        serviceId: p.service_id,
      })),
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
