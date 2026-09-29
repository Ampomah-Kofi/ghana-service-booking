import { AppError } from "@/lib/errors";
import { reviewsQuery } from "@/schemas/api-v1";
import { apiClient, apiError, isPersonalised, json, validationError } from "@/server/api/http";
import { toApiReview } from "@/server/api/reviews";
import { getBusinessBySlug } from "@/server/businesses/queries";
import { listBusinessReviews, ratingSummary } from "@/server/reviews/reviews";

/** GET /api/v1/businesses/{slug}/reviews?page=&page_size= : published reviews, newest first, with the rating summary. */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/businesses/[slug]/reviews">) {
  const { slug } = await params;
  const parsed = reviewsQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const { page, page_size } = parsed.data;
  try {
    const db = apiClient(request);
    const business = await getBusinessBySlug(db, slug);
    if (!business || business.status !== "published") throw new AppError("NOT_FOUND", "Business not found.");
    const [summary, reviews] = await Promise.all([
      ratingSummary(db, business.id),
      listBusinessReviews(db, business.id, { limit: page_size, offset: (page - 1) * page_size }),
    ]);
    return json(
      {
        data: reviews.map(toApiReview),
        meta: { average: summary.average, count: summary.count, distribution: summary.distribution, page, page_size },
      },
      { cacheSeconds: 60, personalised: isPersonalised(request) },
    );
  } catch (error) {
    return apiError(error);
  }
}
