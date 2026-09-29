import "server-only";
import type { z } from "zod";
import { nullableArg, type Db } from "@/server/db/client";
import type { categoryAdminSchema } from "@/schemas/catalog";
import { toAppError } from "@/server/businesses/errors";

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  keywords: string[];
  sortOrder: number;
  isActive: boolean;
};

/** Admins see inactive categories too (RLS policy "admins read all categories"). */
export async function listAllCategories(db: Db): Promise<AdminCategory[]> {
  const { data, error } = await db
    .from("categories")
    .select("id, name, slug, description, search_keywords, sort_order, is_active")
    .order("sort_order")
    .order("name");
  if (error) throw toAppError(error);
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    keywords: c.search_keywords,
    sortOrder: c.sort_order,
    isActive: c.is_active,
  }));
}

/** Creates or updates a category; the database writes the audit log entry in the same transaction. */
export async function saveCategory(
  db: Db,
  id: string | null,
  input: z.infer<typeof categoryAdminSchema>,
): Promise<string> {
  const { data, error } = await db.rpc("admin_save_category", {
    p_id: nullableArg(id),
    p_name: input.name,
    p_slug: input.slug,
    p_description: input.description,
    p_keywords: input.keywords,
    p_sort_order: input.sortOrder,
    p_is_active: input.isActive,
    p_reason: input.reason,
  });
  if (error) throw toAppError(error);
  return data;
}
