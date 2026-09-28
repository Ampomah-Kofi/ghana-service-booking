import type { z } from "zod";
import { publicEnv } from "@/lib/public-env";
import { searchQuery, type searchResponse } from "@/schemas/api-v1";
import { toApiCard } from "@/server/api/reviews";
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
      data: result.results.map((c) => toApiCard(c, supabaseUrl)),
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
