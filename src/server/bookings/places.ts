import "server-only";
import type { Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";

export type Place = {
  businessId: string;
  slug: string;
  name: string;
  timezone: string;
  categorySlug: string | null;
  imagePath: string | null;
  area: string | null;
  lastVisitAt: string;
  /** True when the customer hasn't been yet (only upcoming bookings). */
  upcoming: boolean;
  lastServiceName: string;
  lastServiceId: string;
  lastStaffId: string;
};

/**
 * "Your places": businesses the customer has booked, most recent first, with what they
 * had last time (for one-tap rebooking). Only published businesses come back (RLS).
 */
export async function listMyPlaces(db: Db, userId: string, limit = 8): Promise<Place[]> {
  const { data: visits, error } = await db
    .from("appointments")
    .select("business_id, service_id, staff_id, service_name, starts_at")
    .eq("customer_user_id", userId)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throw toAppError(error);

  // Per business: the most recent visit that has started; if all are still ahead, the soonest upcoming one.
  const now = Date.now();
  const latest = new Map<string, (typeof visits)[number]>();
  for (const v of visits) {
    const current = latest.get(v.business_id);
    const started = new Date(v.starts_at).getTime() <= now;
    const currentStarted = current ? new Date(current.starts_at).getTime() <= now : false;
    if (!current || (started && !currentStarted) || (!started && !currentStarted && v.starts_at < current.starts_at)) {
      latest.set(v.business_id, v);
    }
  }
  const ids = [...latest.values()]
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .map((v) => v.business_id)
    .slice(0, limit);
  if (ids.length === 0) return [];

  const { data: businesses, error: bError } = await db
    .from("businesses")
    .select(
      "id, slug, name, timezone, logo_path, business_categories ( is_primary, categories ( slug ) ), business_locations ( is_primary, locality_text, areas ( name ), cities ( name ) ), business_photos ( path_small, sort_order )",
    )
    .in("id", ids)
    .eq("status", "published")
    .is("deleted_at", null);
  if (bError) throw toAppError(bError);

  return ids.flatMap((id) => {
    const b = businesses.find((x) => x.id === id);
    const v = latest.get(id);
    if (!b || !v) return [];
    const loc = b.business_locations.find((l) => l.is_primary);
    const photo = [...b.business_photos].sort((p, q) => p.sort_order - q.sort_order)[0];
    return [
      {
        businessId: b.id,
        slug: b.slug,
        name: b.name,
        timezone: b.timezone,
        categorySlug: b.business_categories.find((c) => c.is_primary)?.categories?.slug ?? null,
        imagePath: photo?.path_small ?? b.logo_path,
        area: loc?.areas?.name ?? loc?.cities?.name ?? loc?.locality_text ?? null,
        lastVisitAt: v.starts_at,
        upcoming: new Date(v.starts_at).getTime() > now,
        lastServiceName: v.service_name,
        lastServiceId: v.service_id,
        lastStaffId: v.staff_id,
      },
    ];
  });
}
