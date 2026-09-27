import Link from "next/link";
import { ResultList } from "@/components/marketplace/result-list";
import { SearchForm } from "@/components/marketplace/search-form";
import { BRAND } from "@/lib/brand";
import { publicEnv } from "@/lib/public-env";
import { listActiveCategories } from "@/server/catalog/categories";
import { listCities, listCurrencies } from "@/server/catalog/currencies";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
import { recentlyJoined } from "@/server/search/marketplace";

const EXAMPLES = ["Barber in East Legon", "Braids in Kumasi", "Nails near me", "Home cleaning"];

export default async function HomePage() {
  const db = await createUserClient();
  const [categories, cities, recent, currencies] = await Promise.all([
    listActiveCategories(db),
    listCities(db, serverEnv().DEFAULT_COUNTRY_CODE),
    recentlyJoined(db, 6),
    listCurrencies(db),
  ]);
  const sectionTitle = "mb-3 text-title-2 font-semibold tracking-tight";

  return (
    <>
      <section className="mb-8 pt-2">
        <h1 className="mb-2 text-large-title font-bold tracking-tight">{BRAND.tagline}</h1>
        <p className="mb-5 text-body text-text-secondary">
          Barbers, braiders, nail techs, tutors and more. See prices, then book.
        </p>
        <SearchForm />
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-footnote text-text-secondary">
          <span>Try:</span>
          {EXAMPLES.map((example) => (
            <Link key={example} href={`/search?q=${encodeURIComponent(example)}`} className="text-accent">
              {example}
            </Link>
          ))}
        </p>
      </section>

      <section aria-labelledby="categories-heading" className="mb-8">
        <h2 id="categories-heading" className={sectionTitle}>
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
                <Link
                  href={`/categories/${category.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-surface-elevated px-4 text-callout shadow-card hover:bg-fill"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="mb-8">
          <h2 id="recent-heading" className={sectionTitle}>
            Recently joined
          </h2>
          <ResultList cards={recent} supabaseUrl={publicEnv().NEXT_PUBLIC_SUPABASE_URL} currencies={currencies} />
        </section>
      ) : null}

      <section aria-labelledby="cities-heading" className="mb-8">
        <h2 id="cities-heading" className={sectionTitle}>
          Browse by town
        </h2>
        <ul className="flex flex-wrap gap-2">
          {cities.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/search?where=${encodeURIComponent(city.name)}`}
                className="inline-flex min-h-11 items-center rounded-full bg-fill px-4 text-callout hover:opacity-80"
              >
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-callout text-text-secondary">
        Are you a professional?{" "}
        <Link href="/onboarding" className="font-medium text-accent">
          List your business for free
        </Link>
      </p>
    </>
  );
}
