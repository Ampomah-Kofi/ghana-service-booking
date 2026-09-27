import "server-only";
import { createUserClient } from "@/server/db/supabase-server";
import { AppError } from "@/lib/errors";

export type CategorySummary = { id: string; name: string; slug: string };

/** Active categories in admin-defined order (public data; RLS hides inactive ones). */
export async function listActiveCategories(): Promise<CategorySummary[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .is("parent_id", null)
    .order("sort_order")
    .order("name");
  if (error) throw new AppError("INTERNAL", "Could not load categories.");
  return data;
}
