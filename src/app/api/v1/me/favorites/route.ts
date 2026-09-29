import { publicEnv } from "@/lib/public-env";
import { apiError, apiUser, json } from "@/server/api/http";
import { toApiCard } from "@/server/api/reviews";
import { listMyFavorites } from "@/server/favorites/favorites";

/** GET /api/v1/me/favorites (Bearer): saved businesses as result cards, newest first. */
export async function GET(request: Request) {
  try {
    const { db } = await apiUser(request);
    const cards = await listMyFavorites(db);
    const supabaseUrl = publicEnv().NEXT_PUBLIC_SUPABASE_URL;
    return json({ data: cards.map((c) => toApiCard(c, supabaseUrl)) }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
