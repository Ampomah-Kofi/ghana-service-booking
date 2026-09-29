import { AppError } from "@/lib/errors";
import { replyBody } from "@/schemas/api-v1";
import { apiError, apiUser, json, uuidParam, validationError } from "@/server/api/http";
import { toApiReview } from "@/server/api/reviews";
import { getReview, replyToReview } from "@/server/reviews/reviews";

/** PUT /api/v1/reviews/{id}/reply (Bearer, owner/manager): post or replace the business's one public reply. */
export async function PUT(request: Request, { params }: RouteContext<"/api/v1/reviews/[id]/reply">) {
  const { id } = await params;
  try {
    const { db, userId } = await apiUser(request);
    uuidParam(id);
    const parsed = replyBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    await replyToReview(db, id, parsed.data.body);
    const updated = await getReview(db, id, userId);
    if (!updated) throw new AppError("NOT_FOUND", "Review not found.");
    return json({ data: toApiReview(updated) }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
