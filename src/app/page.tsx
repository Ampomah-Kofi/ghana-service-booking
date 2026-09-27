import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { listActiveCategories } from "@/server/catalog/categories";

export default async function HomePage() {
  const categories = await listActiveCategories();

  return (
    <>
      <section className="mb-8 pt-4">
        <h1 className="text-large-title font-bold tracking-tight">{BRAND.tagline}</h1>
        <p className="mt-2 text-body text-text-secondary">
          Barbers, braiders, nail techs, tutors and more. See prices and open times, then book in a minute.
        </p>
      </section>

      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="mb-3 text-title-2 font-semibold tracking-tight">
          Browse categories
        </h2>
        {categories.length === 0 ? (
          <p className="rounded-card bg-surface-elevated p-4 text-body text-text-secondary">
            No categories yet. Check back soon.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.id}>
                {/* Category pages arrive in Phase 4; plain pills for now. */}
                <span className="inline-flex min-h-11 items-center rounded-full bg-surface-elevated px-4 text-callout shadow-card">
                  {category.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-callout text-text-secondary">
        Are you a professional?{" "}
        <Link href="/sign-in" className="font-medium text-accent">
          Sign in to get started
        </Link>
      </p>
    </>
  );
}
