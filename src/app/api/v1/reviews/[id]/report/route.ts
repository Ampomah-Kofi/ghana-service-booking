import { reportBody } from "@/schemas/api-v1";
import { apiError, apiUser, json, uuidParam, validationError } from "@/server/api/http";
import { reportReview } from "@/server/reviews/reviews";

/** POST /api/v1/reviews/{id}/report (Bearer): flag a review for moderators (once per person). */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/reviews/[id]/report">) {
  const { id } = await params;
  try {
    const { db } = await apiUser(request);
    uuidParam(id);
    const parsed = reportBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    await reportReview(db, id, parsed.data.reason, parsed.data.details || null);
    return json({ data: { review_id: id, reported: true } }, { status: 202, personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
