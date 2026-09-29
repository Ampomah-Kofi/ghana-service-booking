"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { createUserClient } from "@/server/db/supabase-server";
import { addFavorite, removeFavorite } from "@/server/favorites/favorites";
import { AppError } from "@/lib/errors";

const toggleSchema = z.object({ businessId: z.uuid(), save: z.enum(["1", "0"]) });

export type FavoriteState = { saved: boolean; error?: string };

/** Save or unsave a business. Works as a plain form post before JavaScript loads. */
export async function toggleFavoriteAction(prev: FavoriteState, formData: FormData): Promise<FavoriteState> {
  const parsed = toggleSchema.safeParse({ businessId: formData.get("businessId"), save: formData.get("save") });
  if (!parsed.success) return { ...prev, error: "Something went wrong." };
  const save = parsed.data.save === "1";
  try {
    const user = await requireUser();
    const db = await createUserClient();
    if (save) await addFavorite(db, user.id, parsed.data.businessId);
    else await removeFavorite(db, user.id, parsed.data.businessId);
  } catch (error) {
    return { saved: !save, error: error instanceof AppError ? error.message : "Something went wrong." };
  }
  revalidatePath("/favorites");
  return { saved: save };
}
