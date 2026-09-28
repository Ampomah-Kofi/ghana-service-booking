import "server-only";
import { AppError } from "@/lib/errors";
import type { Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";
import { toCard, type BusinessCard } from "@/server/search/marketplace";

/** The caller's saved businesses as result cards, newest first (RLS + auth.uid() in the function). */
export async function listMyFavorites(db: Db, { limit = 50, offset = 0 } = {}): Promise<BusinessCard[]> {
  const { data, error } = await db.rpc("my_favorite_businesses", { p_limit: limit, p_offset: offset });
  if (error) throw toAppError(error);
  return data.map(toCard);
}

/** Which of these businesses the user has saved (for hearts on cards). */
export async function favoriteIdsAmong(db: Db, userId: string, businessIds: string[]): Promise<Set<string>> {
  if (businessIds.length === 0) return new Set();
  const { data, error } = await db
    .from("favorites")
    .select("business_id")
    .eq("user_id", userId)
    .in("business_id", [...new Set(businessIds)].slice(0, 200));
  if (error) throw toAppError(error);
  return new Set(data.map((f) => f.business_id));
}

export async function isFavorite(db: Db, userId: string, businessId: string): Promise<boolean> {
  return (await favoriteIdsAmong(db, userId, [businessId])).has(businessId);
}

/** Idempotent: saving twice is fine. Drafts and unknown businesses are refused by RLS (→ NOT_FOUND). */
export async function addFavorite(db: Db, userId: string, businessId: string): Promise<void> {
  const { error } = await db
    .from("favorites")
    .upsert(
      { user_id: userId, business_id: businessId },
      { onConflict: "user_id,business_id", ignoreDuplicates: true },
    );
  if (error) {
    if (error.code === "42501" || error.code === "23503")
      throw new AppError("NOT_FOUND", "This business isn't available.");
    throw toAppError(error);
  }
}

export async function removeFavorite(db: Db, userId: string, businessId: string): Promise<void> {
  const { error } = await db.from("favorites").delete().eq("user_id", userId).eq("business_id", businessId);
  if (error) throw toAppError(error);
}
