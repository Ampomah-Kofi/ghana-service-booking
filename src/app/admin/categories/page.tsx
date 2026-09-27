import type { Metadata } from "next";
import { listAllCategories } from "@/server/admin/categories";
import { createUserClient } from "@/server/db/supabase-server";
import { CategoryForm } from "./category-form";

export const metadata: Metadata = { title: "Categories · Admin" };

export default async function AdminCategoriesPage() {
  const categories = await listAllCategories(await createUserClient());
  const next = (categories.at(-1)?.sortOrder ?? 0) + 10;

  return (
    <>
      <h1 className="mb-2 text-display font-bold tracking-tight">Categories</h1>
      <p className="mb-6 text-body text-ink-muted">
        Changes show on the site straight away. Every change is recorded in the audit log.
      </p>
      <ul className="mb-8 divide-y divide-border overflow-hidden rounded-card bg-card border border-border">
        {categories.map((c) => (
          <li key={c.id}>
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-fill">
                <span className="text-body font-medium">
                  {c.name}
                  {c.isActive ? null : (
                    <span className="ml-2 rounded-full bg-fill px-2 py-0.5 text-small font-normal text-ink-muted">
                      Hidden
                    </span>
                  )}
                </span>
                <span className="text-small text-ink-muted tabular-nums">#{c.sortOrder}</span>
              </summary>
              <CategoryForm
                values={{
                  id: c.id,
                  name: c.name,
                  slug: c.slug,
                  description: c.description ?? "",
                  keywords: c.keywords.join(", "),
                  sortOrder: c.sortOrder,
                  isActive: c.isActive,
                }}
              />
            </details>
          </li>
        ))}
      </ul>
      <h2 className="mb-2 px-4 text-heading font-semibold text-ink">New category</h2>
      <div className="rounded-card bg-card border border-border">
        <CategoryForm
          values={{ name: "", slug: "", description: "", keywords: "", sortOrder: next, isActive: false }}
        />
      </div>
    </>
  );
}
