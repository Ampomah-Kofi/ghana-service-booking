import { AppError } from "@/lib/errors";
import { reviewBody } from "@/schemas/api-v1";
import { apiError, apiUser, json, uuidParam, validationError } from "@/server/api/http";
import { toApiReview } from "@/server/api/reviews";
import { getReview, updateReview } from "@/server/reviews/reviews";

/** PATCH /api/v1/reviews/{id} (Bearer): the author edits stars and text within 14 days. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/v1/reviews/[id]">) {
  const { id } = await params;
  try {
    const { db, userId } = await apiUser(request);
    uuidParam(id);
    const parsed = reviewBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    await updateReview(db, id, { rating: parsed.data.rating, body: parsed.data.body || null });
    const updated = await getReview(db, id, userId);
    if (!updated) throw new AppError("NOT_FOUND", "Review not found.");
    return json({ data: toApiReview(updated) }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
