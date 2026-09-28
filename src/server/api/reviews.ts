import "server-only";
import type { z } from "zod";
import { publicMediaUrl } from "@/lib/images";
import type { businessCard, review } from "@/schemas/api-v1";
import type { ReviewView } from "@/server/reviews/reviews";
import type { BusinessCard } from "@/server/search/marketplace";

export function toApiReview(r: ReviewView): z.infer<typeof review> {
  return {
    id: r.id,
    business_id: r.businessId,
    appointment_id: r.appointmentId,
    author_name: r.authorName,
    mine: r.mine,
    service_name: r.serviceName,
    staff_name: r.staffName,
    visited_on: r.visitedOn,
    rating: r.rating,
    body: r.body,
    status: r.status,
    reply: r.reply,
    created_at: r.createdAt,
    editable_until: r.editableUntil,
  };
}

/** Result card as the API shapes it (shared by /search and /me/favorites). */
export function toApiCard(c: BusinessCard, supabaseUrl: string): z.infer<typeof businessCard> {
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
}
