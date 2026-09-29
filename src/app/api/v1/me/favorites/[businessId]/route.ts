import { z } from "zod";
import { AppError } from "@/lib/errors";
import { apiError, apiUser, json } from "@/server/api/http";
import { addFavorite, removeFavorite } from "@/server/favorites/favorites";

type Ctx = RouteContext<"/api/v1/me/favorites/[businessId]">;

async function businessIdFrom(ctx: Ctx): Promise<string> {
  const parsed = z.uuid().safeParse((await ctx.params).businessId);
  if (!parsed.success) throw new AppError("NOT_FOUND", "Business not found.");
  return parsed.data;
}

/** PUT /api/v1/me/favorites/{businessId} (Bearer): save. Idempotent. */
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { db, userId } = await apiUser(request);
    const businessId = await businessIdFrom(ctx);
    await addFavorite(db, userId, businessId);
    return json({ data: { business_id: businessId, saved: true } }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}

/** DELETE /api/v1/me/favorites/{businessId} (Bearer): unsave. Idempotent. */
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { db, userId } = await apiUser(request);
    const businessId = await businessIdFrom(ctx);
    await removeFavorite(db, userId, businessId);
    return json({ data: { business_id: businessId, saved: false } }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
