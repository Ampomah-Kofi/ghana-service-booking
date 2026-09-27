import { z } from "zod";

/**
 * Public API v1 (docs/architecture.md §12): snake_case JSON, money as
 * { amount_minor, currency }, times as ISO-8601 UTC. These schemas are the
 * contract: route handlers build responses of these types and
 * /api/v1/openapi.json is generated from them.
 */
export const money = z.object({ amount_minor: z.number().int(), currency: z.string().length(3) });

export const apiError = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

export const category = z.object({ id: z.uuid(), name: z.string(), slug: z.string() });
export const categoriesResponse = z.object({ data: z.array(category) });

export const searchQuery = z.object({
  q: z.string().max(100).optional().default(""),
  where: z.string().max(60).optional().default(""),
  category: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(60)
    .optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  sort: z.enum(["relevance", "distance", "newest"]).optional(),
  page: z.coerce.number().int().min(1).max(50).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const businessCard = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  image_url: z.url().nullable(),
  category: z.object({ name: z.string(), slug: z.string() }).nullable(),
  place: z.string().nullable(),
  starting_price: money.extend({ is_from: z.boolean() }).nullable(),
  rating: z.object({ average: z.number(), count: z.number().int() }).nullable(),
  next_available_at: z.iso.datetime({ offset: true }).nullable(),
  distance_km: z.number().nullable(),
});

export const searchResponse = z.object({
  data: z.array(businessCard),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    page_size: z.number().int(),
    interpretation: z.object({
      category: z.object({ name: z.string(), slug: z.string() }).nullable(),
      place: z.string().nullable(),
      near_me: z.boolean(),
      text: z.string().nullable(),
    }),
    notice: z.string().nullable(),
    needs_location: z.boolean(),
  }),
});

export const businessProfile = z.object({
  data: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    kind: z.enum(["solo", "team"]),
    timezone: z.string(),
    category: z.object({ name: z.string(), slug: z.string() }).nullable(),
    location: z
      .object({
        area: z.string().nullable(),
        city: z.string().nullable(),
        region: z.string().nullable(),
        address_line: z.string().nullable(),
        landmark: z.string().nullable(),
        directions: z.string().nullable(),
        lat: z.number().nullable(),
        lng: z.number().nullable(),
      })
      .nullable(),
    contact: z.object({ phone: z.string().nullable(), whatsapp: z.string().nullable() }),
    logo_url: z.url().nullable(),
    photos: z.array(z.object({ small_url: z.url(), large_url: z.url() })),
    services: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        description: z.string().nullable(),
        price: money,
        price_type: z.enum(["fixed", "from"]),
        duration_minutes: z.number().int(),
        staff_ids: z.array(z.uuid()),
      }),
    ),
    staff: z.array(z.object({ id: z.uuid(), display_name: z.string(), role_title: z.string().nullable() })),
    hours: z.array(z.object({ weekday: z.number().int().min(1).max(7), opens: z.string(), closes: z.string() })),
  }),
});
