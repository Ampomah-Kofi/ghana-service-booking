import { apiError, apiUser, json } from "@/server/api/http";
import { toApiReview } from "@/server/api/reviews";
import { listMyReviews } from "@/server/reviews/reviews";

/** GET /api/v1/me/reviews (Bearer): the caller's reviews, any status, newest first. */
export async function GET(request: Request) {
  try {
    const { db, userId } = await apiUser(request);
    const reviews = await listMyReviews(db, userId);
    return json(
      { data: reviews.map((r) => ({ ...toApiReview(r), business: { name: r.businessName, slug: r.businessSlug } })) },
      { personalised: true },
    );
  } catch (error) {
    return apiError(error);
  }
}
