import type { z } from "zod";
import { socialHref } from "@/lib/social";
import { AppError } from "@/lib/errors";
import { publicMediaUrl } from "@/lib/images";
import { publicEnv } from "@/lib/public-env";
import type { businessProfile } from "@/schemas/api-v1";
import { apiClient, apiError, isPersonalised, json } from "@/server/api/http";
import { listServices } from "@/server/businesses/catalog";
import { getBusinessBySlug } from "@/server/businesses/queries";
import { getBusinessHours } from "@/server/businesses/schedule";
import { listStaff } from "@/server/businesses/team";
import { ratingSummary } from "@/server/reviews/reviews";

/**
 * GET /api/v1/businesses/{slug}: public profile with services, team and hours.
 * RLS decides visibility (published only, unless the Bearer user is on the team).
 */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/businesses/[slug]">) {
  const { slug } = await params;
  try {
    const db = apiClient(request);
    const business = await getBusinessBySlug(db, slug);
    if (!business) throw new AppError("NOT_FOUND", "Business not found.");
    const [services, staff, hours, rating] = await Promise.all([
      listServices(db, business.id),
      listStaff(db, business.id, { withInvites: false }),
      getBusinessHours(db, business.id),
      ratingSummary(db, business.id),
    ]);
    const media = (path: string) => publicMediaUrl(publicEnv().NEXT_PUBLIC_SUPABASE_URL, path);
    const loc = business.location;

    const body: z.infer<typeof businessProfile> = {
      data: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        description: business.description,
        kind: business.kind,
        timezone: business.timezone,
        verified: business.verification.status === "verified",
        verified_at: business.verification.status === "verified" ? business.verification.verifiedAt : null,
        category: business.category ? { name: business.category.name, slug: business.category.slug } : null,
        location: loc
          ? {
              area: loc.areaName,
              city: loc.cityName ?? loc.localityText,
              region: loc.regionName,
              address_line: loc.addressLine,
              landmark: loc.landmark,
              directions: loc.directions,
              lat: loc.lat,
              lng: loc.lng,
            }
          : null,
        contact: { phone: business.phone, whatsapp: business.whatsapp },
        logo_url: business.logoPath ? media(business.logoPath) : null,
        photos: business.photos.map((p) => ({
          small_url: media(p.pathSmall),
          large_url: media(p.pathLarge),
          service_id: p.serviceId,
        })),
        social: Object.fromEntries(
          Object.entries(business.social).map(([k, v]) => [
            k,
            v ? socialHref(k as keyof typeof business.social, v) : null,
          ]),
        ) as Record<keyof typeof business.social, string | null>,
        rating: rating.count > 0 && rating.average !== null ? { average: rating.average, count: rating.count } : null,
        services: services
          .filter((s) => s.isActive)
          .map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            price: { amount_minor: s.priceMinor, currency: s.currencyCode },
            price_type: s.priceType,
            duration_minutes: s.durationMinutes,
            staff_ids: s.staffIds,
          })),
        staff: staff
          .filter((s) => s.isActive)
          .map((s) => ({ id: s.id, display_name: s.displayName, role_title: s.roleTitle })),
        hours,
      },
    };
    return json(body, { cacheSeconds: 60, personalised: isPersonalised(request) });
  } catch (error) {
    return apiError(error);
  }
}
