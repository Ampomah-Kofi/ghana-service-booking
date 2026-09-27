import "server-only";
import type { Db } from "@/server/db/client";
import { nullableArg } from "@/server/db/client";
import { parseSearchQuery } from "@/lib/search-query";
import { toAppError } from "@/server/businesses/errors";

export type BusinessCard = {
  id: string;
  slug: string;
  name: string;
  imagePath: string | null;
  logoPath: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  place: string | null;
  startingPrice: { amountMinor: number; currency: string; isFrom: boolean } | null;
  rating: { average: number; count: number } | null;
  nextAvailableAt: string | null;
  distanceKm: number | null;
  publishedAt: string | null;
};

export type SearchInput = {
  q?: string;
  where?: string;
  categorySlug?: string;
  coords?: { lat: number; lng: number } | null;
  sort?: "relevance" | "distance" | "newest";
  page?: number;
  pageSize?: number;
};

export type SearchResult = {
  results: BusinessCard[];
  total: number;
  page: number;
  pageSize: number;
  interpretation: {
    category: { name: string; slug: string } | null;
    place: string | null;
    nearMe: boolean;
    text: string | null;
  };
  /** Set when we widened the search (e.g. nothing in that town yet). */
  notice: string | null;
  /** "near me" was asked for but no coordinates were given (the browser must ask). */
  needsLocation: boolean;
};

type Row = {
  id: string;
  slug: string;
  name: string;
  logo_path: string | null;
  photo_path: string | null;
  category_name: string | null;
  category_slug: string | null;
  area_name: string | null;
  city_name: string | null;
  locality_text: string | null;
  min_price_minor: number | null;
  has_from_price: boolean | null;
  currency_code: string | null;
  rating_avg: number | null;
  rating_count: number;
  next_available_at: string | null;
  published_at: string | null;
  distance_m: number | null;
  total_count: number;
};

function toCard(row: Row): BusinessCard {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imagePath: row.photo_path,
    logoPath: row.logo_path,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    place: [row.area_name, row.city_name ?? row.locality_text].filter(Boolean).join(", ") || null,
    startingPrice:
      row.min_price_minor !== null && row.currency_code
        ? { amountMinor: row.min_price_minor, currency: row.currency_code, isFrom: Boolean(row.has_from_price) }
        : null,
    rating:
      row.rating_avg !== null && row.rating_count > 0
        ? { average: Number(row.rating_avg), count: row.rating_count }
        : null,
    nextAvailableAt: row.next_available_at,
    distanceKm: row.distance_m !== null ? Math.round(row.distance_m / 100) / 10 : null,
    publishedAt: row.published_at,
  };
}

type Filters = {
  text: string | null;
  categoryId: string | null;
  areaId: string | null;
  cityId: string | null;
  regionId: string | null;
  coords: { lat: number; lng: number } | null;
  sort: "relevance" | "distance" | "newest";
};

async function runSearch(
  db: Db,
  filters: Filters,
  limit: number,
  offset: number,
): Promise<{ rows: Row[]; total: number }> {
  const { data, error } = await db.rpc("search_businesses", {
    p_text: nullableArg(filters.text),
    p_category_id: nullableArg(filters.categoryId),
    p_area_id: nullableArg(filters.areaId),
    p_city_id: nullableArg(filters.cityId),
    p_region_id: nullableArg(filters.regionId),
    p_lat: nullableArg(filters.coords?.lat ?? null),
    p_lng: nullableArg(filters.coords?.lng ?? null),
    p_radius_km: 25,
    p_sort: filters.sort,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw toAppError(error);
  const rows: Row[] = data;
  return { rows, total: rows[0]?.total_count ?? 0 };
}

/**
 * Understands the query ("what in where", "near me"), searches, and widens the
 * search with an explanation when a place has no matches yet.
 */
export async function searchMarketplace(db: Db, input: SearchInput, countryCode: string): Promise<SearchResult> {
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 50);
  const page = Math.min(Math.max(input.page ?? 1, 1), 50);
  const parsed = parseSearchQuery(input.q ?? "");
  const where = (input.where ?? "").trim() || parsed.where;

  const match = await db
    .rpc("match_search_terms", { p_what: parsed.what, p_where: where, p_country_code: countryCode })
    .single();
  if (match.error) throw toAppError(match.error);
  const m = match.data;

  let category: { id: string; name: string; slug: string } | null =
    m.category_id && m.category_name && m.category_slug
      ? { id: m.category_id, name: m.category_name, slug: m.category_slug }
      : null;
  if (input.categorySlug) {
    const explicit = await db.from("categories").select("id, name, slug").eq("slug", input.categorySlug).maybeSingle();
    if (explicit.error) throw toAppError(explicit.error);
    category = explicit.data;
  }

  // If the words named a category, the category filter covers them; otherwise search the words.
  const text = category && m.category_id === category.id ? null : parsed.what || null;
  const place = m.area_name ? `${m.area_name}, ${m.city_name}` : (m.city_name ?? m.region_name ?? null);
  const nearMe = parsed.nearMe;
  const coords = input.coords ?? null;
  const sort = input.sort ?? (coords ? "distance" : "relevance");

  const filters: Filters = {
    text,
    categoryId: category?.id ?? null,
    areaId: m.area_id,
    cityId: m.area_id ? null : m.city_id,
    regionId: m.area_id || m.city_id ? null : m.region_id,
    coords,
    sort,
  };
  const offset = (page - 1) * pageSize;
  let { rows, total } = await runSearch(db, filters, pageSize, offset);
  let notice: string | null =
    where && !place ? `We couldn't find a place called "${where}", so we searched everywhere.` : null;

  if (total === 0 && page === 1 && (place || coords)) {
    const widened = await runSearch(
      db,
      { ...filters, areaId: null, cityId: null, regionId: null, coords: null, sort: "relevance" },
      pageSize,
      0,
    );
    if (widened.total > 0) {
      const thing = category?.name.toLowerCase() ?? (text ? `"${text}"` : "businesses");
      notice = `No ${thing} ${place ? `in ${place}` : "near you"} yet. Here are other places.`;
      ({ rows, total } = widened);
    }
  }

  return {
    results: rows.map(toCard),
    total,
    page,
    pageSize,
    interpretation: { category: category ? { name: category.name, slug: category.slug } : null, place, nearMe, text },
    notice,
    needsLocation: nearMe && !coords,
  };
}

/** Newest published businesses, for the home page. */
export async function recentlyJoined(db: Db, limit = 8): Promise<BusinessCard[]> {
  const { rows } = await runSearch(
    db,
    { text: null, categoryId: null, areaId: null, cityId: null, regionId: null, coords: null, sort: "newest" },
    limit,
    0,
  );
  return rows.map(toCard);
}
