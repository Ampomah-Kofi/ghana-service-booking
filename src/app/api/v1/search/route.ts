import type { z } from "zod";
import { publicMediaUrl } from "@/lib/images";
import { publicEnv } from "@/lib/public-env";
import { searchQuery, type searchResponse } from "@/schemas/api-v1";
import { apiClient, apiError, isPersonalised, json, validationError } from "@/server/api/http";
import { serverEnv } from "@/server/env";
import { searchMarketplace } from "@/server/search/marketplace";

/** GET /api/v1/search?q=Barber in East Legon&lat=&lng=&page= : same engine as the website. */
export async function GET(request: Request) {
  const parsed = searchQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const p = parsed.data;
  try {
    const coords = p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : null;
    const result = await searchMarketplace(
      apiClient(request),
      { q: p.q, where: p.where, categorySlug: p.category, coords, sort: p.sort, page: p.page, pageSize: p.page_size },
      serverEnv().DEFAULT_COUNTRY_CODE,
    );
    const supabaseUrl = publicEnv().NEXT_PUBLIC_SUPABASE_URL;
    const body: z.infer<typeof searchResponse> = {
      data: result.results.map((c) => {
        const image = c.imagePath ?? c.logoPath;
        return {
          id: c.id,
          slug: c.slug,
          name: c.name,
          image_url: image ? publicMediaUrl(supabaseUrl, image) : null,
          category: c.categoryName && c.categorySlug ? { name: c.categoryName, slug: c.categorySlug } : null,
          place: c.place,
          starting_price: c.startingPrice
            ? {
                amount_minor: c.startingPrice.amountMinor,
                currency: c.startingPrice.currency,
                is_from: c.startingPrice.isFrom,
              }
            : null,
          rating: c.rating,
          next_available_at: c.nextAvailableAt,
          distance_km: c.distanceKm,
        };
      }),
      meta: {
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        interpretation: {
          category: result.interpretation.category,
          place: result.interpretation.place,
          near_me: result.interpretation.nearMe,
          text: result.interpretation.text,
        },
        notice: result.notice,
        needs_location: result.needsLocation,
      },
    };
    // Location-based results are specific to the caller; don't let a CDN share them.
    return json(body, { cacheSeconds: 30, personalised: isPersonalised(request) || coords !== null });
  } catch (error) {
    return apiError(error);
  }
}
