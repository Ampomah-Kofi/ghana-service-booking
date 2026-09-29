import { AppError } from "@/lib/errors";
import { reviewBody } from "@/schemas/api-v1";
import { apiError, apiUser, json, uuidParam, validationError } from "@/server/api/http";
import { toApiReview } from "@/server/api/reviews";
import { getReview, submitReview } from "@/server/reviews/reviews";

/** POST /api/v1/appointments/{id}/review (Bearer): review your completed visit (once). */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/appointments/[id]/review">) {
  const { id } = await params;
  try {
    const { db, userId } = await apiUser(request);
    uuidParam(id);
    const parsed = reviewBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    const reviewId = await submitReview(db, id, { rating: parsed.data.rating, body: parsed.data.body || null });
    const created = await getReview(db, reviewId, userId);
    if (!created) throw new AppError("INTERNAL", "Something went wrong.");
    return json({ data: toApiReview(created) }, { status: 201, personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
