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
    photos: z.array(
      z.object({
        small_url: z.url(),
        large_url: z.url(),
        service_id: z.uuid().nullable().describe("Service shown, if tagged"),
      }),
    ),
    rating: z.object({ average: z.number(), count: z.number().int() }).nullable(),
    social: z
      .object({
        instagram: z.url().nullable(),
        tiktok: z.url().nullable(),
        x: z.url().nullable(),
        facebook: z.url().nullable(),
        youtube: z.url().nullable(),
        website: z.url().nullable(),
      })
      .describe("Profile links, or null"),
    services: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        description: z.string().nullable(),
        price: money,
        price_type: z.enum(["fixed", "from", "on_request"]).describe("on_request: no amount; agreed with the business"),
        duration_minutes: z.number().int(),
        staff_ids: z.array(z.uuid()),
      }),
    ),
    staff: z.array(z.object({ id: z.uuid(), display_name: z.string(), role_title: z.string().nullable() })),
    hours: z.array(z.object({ weekday: z.number().int().min(1).max(7), opens: z.string(), closes: z.string() })),
  }),
});

// ── Phase 5: availability and appointments ──────────────────────────────────

export const availabilityQuery = z.object({
  service_id: z.uuid(),
  staff_id: z
    .union([z.uuid(), z.literal("any")])
    .optional()
    .default("any"),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("First local date (YYYY-MM-DD) in the business's timezone. Default: today there."),
  days: z.coerce.number().int().min(1).max(14).optional().default(7),
});

export const availabilityResponse = z.object({
  data: z.array(
    z.object({
      date: z.string().describe("Local date in the business's timezone"),
      slots: z.array(
        z.object({
          starts_at: z.iso.datetime({ offset: true }),
          staff_ids: z.array(z.uuid()).describe('Who is free at this time, in the order "any available" tries them'),
        }),
      ),
    }),
  ),
  meta: z.object({ timezone: z.string(), last_bookable_date: z.string() }),
});

export const appointment = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "confirmed", "arrived", "completed", "cancelled", "no_show"]),
  source: z.enum(["online", "manual", "walk_in"]),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  business: z.object({
    id: z.uuid(),
    name: z.string().nullable(),
    slug: z.string().nullable(),
    timezone: z.string().nullable(),
  }),
  service: z.object({ id: z.uuid(), name: z.string() }),
  staff: z.object({ id: z.uuid(), display_name: z.string().nullable() }),
  price: money.extend({ type: z.enum(["fixed", "from", "on_request"]) }),
  deposit: money.nullable(),
  final_price: money.nullable().describe("What was actually charged, recorded when completing"),
  payment_status: z.enum(["pending", "paid", "partially_paid", "failed", "refunded"]).nullable(),
  customer: z.object({ name: z.string(), phone: z.string().nullable() }),
  note: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  can_change: z.boolean().describe("Whether the customer may still cancel or reschedule online"),
});

export const appointmentResponse = z.object({ data: appointment });
export const myAppointmentsResponse = z.object({
  data: z.object({ upcoming: z.array(appointment), past: z.array(appointment) }),
});

export const createAppointmentBody = z.object({
  business_id: z.uuid(),
  service_id: z.uuid(),
  staff_id: z.union([z.uuid(), z.literal("any")]).default("any"),
  starts_at: z.iso.datetime({ offset: true }),
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().trim().max(32).optional().describe("Defaults to the phone number on the account"),
  note: z.string().trim().max(500).optional(),
});

export const cancelAppointmentBody = z.object({ reason: z.string().trim().max(200).optional() });

export const rescheduleAppointmentBody = z.object({
  staff_id: z.union([z.uuid(), z.literal("any")]).default("any"),
  starts_at: z.iso.datetime({ offset: true }),
});

// ── Phase 6: provider endpoints ─────────────────────────────────────────────

export const businessAppointmentsQuery = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("First local date (YYYY-MM-DD) in the business's timezone"),
  days: z.coerce.number().int().min(1).max(31).optional().default(1),
  include_cancelled: z.enum(["true", "false"]).optional().default("false"),
});

export const businessAppointmentsResponse = z.object({
  data: z.array(appointment),
  meta: z.object({ timezone: z.string(), can_manage: z.boolean(), own_staff_id: z.uuid().nullable() }),
});

export const createManualAppointmentBody = z.object({
  service_id: z.uuid(),
  staff_id: z.uuid(),
  walk_in: z.boolean().default(false),
  starts_at: z.iso.datetime({ offset: true }).optional().describe("Required unless walk_in (which starts now)"),
  client_id: z.uuid().optional(),
  client: z
    .object({ name: z.string().trim().max(120).optional(), phone: z.string().trim().max(32).optional() })
    .optional(),
  note: z.string().trim().max(500).optional(),
  allow_outside_hours: z.boolean().default(false),
});

export const statusChangeBody = z.object({
  status: z.enum(["confirmed", "arrived", "completed", "cancelled", "no_show"]),
  reason: z.string().trim().max(200).optional(),
  final_price_minor: z.number().int().min(0).optional(),
});

// ── Phase 7: favourites and reviews ─────────────────────────────────────────

export const favoritesResponse = z.object({ data: z.array(businessCard) });
export const favoriteState = z.object({ data: z.object({ business_id: z.uuid(), saved: z.boolean() }) });

export const review = z.object({
  id: z.uuid(),
  business_id: z.uuid(),
  appointment_id: z.uuid(),
  author_name: z.string(),
  mine: z.boolean(),
  service_name: z.string(),
  staff_name: z.string().nullable(),
  visited_on: z.iso.date(),
  rating: z.number().int().min(1).max(5),
  body: z.string().nullable(),
  status: z.enum(["published", "hidden", "removed"]),
  reply: z.object({ body: z.string(), at: z.iso.datetime({ offset: true }) }).nullable(),
  created_at: z.iso.datetime({ offset: true }),
  editable_until: z.iso.datetime({ offset: true }).nullable(),
});
export const reviewResponse = z.object({ data: review });

export const reviewsQuery = z.object({
  page: z.coerce.number().int().min(1).max(50).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export const businessReviewsResponse = z.object({
  data: z.array(review),
  meta: z.object({
    average: z.number().nullable(),
    count: z.number().int(),
    distribution: z.array(z.number().int()).length(5).describe("Published reviews per star, index 0 = 1 star"),
    page: z.number().int(),
    page_size: z.number().int(),
  }),
});
export const myReviewsResponse = z.object({
  data: z.array(review.extend({ business: z.object({ name: z.string(), slug: z.string() }) })),
});

export const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1000).nullable().optional(),
});
export const replyBody = z.object({ body: z.string().trim().min(1).max(1000) });
export const reportBody = z.object({
  reason: z.enum(["spam", "offensive", "not_genuine", "private_info", "other"]),
  details: z.string().trim().max(500).nullable().optional(),
});
