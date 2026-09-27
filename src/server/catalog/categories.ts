import "server-only";
import type { Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";

export type CategorySummary = { id: string; name: string; slug: string };

/** Active top-level categories in admin-defined order (public data; RLS hides inactive ones). */
export async function listActiveCategories(db: Db): Promise<CategorySummary[]> {
  const { data, error } = await db
    .from("categories")
    .select("id, name, slug")
    .is("parent_id", null)
    .order("sort_order")
    .order("name");
  if (error) throw toAppError(error, "Could not load categories.");
  return data;
}
