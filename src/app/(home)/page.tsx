import Link from "next/link";
import type { ReactNode } from "react";
import { BusinessCard } from "@/components/marketplace/business-card";
import { Cover } from "@/components/marketplace/cover";
import { SearchForm } from "@/components/marketplace/search-form";
import { ChevronRightIcon, StoreIcon } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";
import { publicEnv } from "@/lib/public-env";
import { listActiveCategories } from "@/server/catalog/categories";
import { listCities, listCurrencies } from "@/server/catalog/currencies";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
import { getCurrentUser } from "@/server/auth/session";
import { listMyPlaces } from "@/server/bookings/places";
import { nextAvailableToday } from "@/server/scheduling/next-available";
import { recentlyJoined, type BusinessCard as Card } from "@/server/search/marketplace";
import { PlaceCard } from "@/components/marketplace/place-card";

const EXAMPLES = ["Barber in East Legon", "Braids in Kumasi", "Nails near me", "Home cleaning"];

/** Explore: search first, then categories and swipeable rows of providers (SPEC §11). */
export default async function HomePage() {
  const db = await createUserClient();
  const user = await getCurrentUser();
  const [categories, cities, recent, currencies, places] = await Promise.all([
    listActiveCategories(db),
    listCities(db, serverEnv().DEFAULT_COUNTRY_CODE),
    recentlyJoined(db, 40),
    listCurrencies(db),
    user ? listMyPlaces(db, user.id) : Promise.resolve([]),
  ]);
  // Live "next free time today" for everything shown, in one batch (same engine as booking).
  const next = await nextAvailableToday(
    db,
    recent.map((c) => c.id),
  );
  const availableToday = recent
    .filter((c) => next.has(c.id))
    .sort((a, b) => (next.get(a.id)?.at.getTime() ?? 0) - (next.get(b.id)?.at.getTime() ?? 0));
  const supabaseUrl = publicEnv().NEXT_PUBLIC_SUPABASE_URL;

  // One query, grouped: a row per category that has providers, in the admin's category order.
  const byCategory = new Map<string, Card[]>();
  for (const card of recent) {
    if (!card.categorySlug) continue;
    byCategory.set(card.categorySlug, [...(byCategory.get(card.categorySlug) ?? []), card]);
  }
  const categoryRows = categories.filter((c) => byCategory.has(c.slug)).slice(0, 4);

  const row = (cards: Card[], eagerFirst = false) => (
    <ul className="rail -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {cards.map((card, i) => (
        <li key={card.id} className="w-3/4 max-w-72 shrink-0">
          <BusinessCard
            card={card}
            supabaseUrl={supabaseUrl}
            currencies={currencies}
            compact
            eager={eagerFirst && i < 2}
            next={next.get(card.id)?.label}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <header className="mb-5 pt-2">
        <p className="text-small font-medium text-primary">Akwaaba</p>
        <h1 className="text-display font-bold tracking-tight">What would you like to book?</h1>
      </header>

      <section className="mb-7" aria-label="Search">
        <SearchForm />
        <ul className="rail -mx-4 mt-1 flex gap-2 overflow-x-auto px-4">
          {EXAMPLES.map((example) => (
            <li key={example} className="shrink-0">
              <Link
                href={`/search?q=${encodeURIComponent(example)}`}
                className="pressable inline-flex min-h-9 items-center rounded-full bg-fill px-3.5 text-small"
              >
                {example}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {places.length > 0 ? (
        <Section title="Your places" id="places">
          <ul className="rail -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {places.map((place) => (
              <li key={place.businessId} className="w-3/4 max-w-72 shrink-0">
                <PlaceCard place={place} supabaseUrl={supabaseUrl} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Categories" id="categories">
        {categories.length === 0 ? (
          <p className="rounded-card border border-border bg-card p-4 text-body text-ink-muted">
            No categories yet. Check back soon.
          </p>
        ) : (
          <ul className="rail -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {categories.map((category) => (
              <li key={category.id} className="w-20 shrink-0">
                <Link href={`/categories/${category.slug}`} className="pressable block text-center">
                  <span className="mb-1.5 block aspect-square overflow-hidden rounded-card">
                    <Cover categorySlug={category.slug} seed={category.id} iconScale={1.35} />
                  </span>
                  <span className="line-clamp-2 text-caption font-medium">{category.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {availableToday.length > 0 ? (
        <Section title="Available today" id="today" href="/search?today=1">
          {row(availableToday.slice(0, 8), true)}
        </Section>
      ) : null}

      {recent.length > 0 ? (
        <Section title={`New on ${BRAND.name}`} id="recent">
          {row(recent.slice(0, 8), availableToday.length === 0)}
        </Section>
      ) : (
        <p className="mb-8 rounded-card border border-border bg-card p-5 text-body text-ink-muted">
          No businesses yet. Be the first to{" "}
          <Link href="/onboarding" className="font-medium text-primary">
            list yours
          </Link>
          .
        </p>
      )}

      {categoryRows.map((c) => (
        <Section key={c.id} title={c.name} id={`cat-${c.slug}`} href={`/categories/${c.slug}`}>
          {row(byCategory.get(c.slug) ?? [])}
        </Section>
      ))}

      <Section title="Browse by town" id="towns">
        <ul className="flex flex-wrap gap-2">
          {cities.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/search?where=${encodeURIComponent(city.name)}`}
                className="pressable inline-flex min-h-10 items-center rounded-full border border-border bg-card px-4 text-small"
              >
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Link
        href="/onboarding"
        className="pressable mb-4 flex items-center gap-4 overflow-hidden rounded-card bg-primary p-5 text-on-primary"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-on-primary/15">
          <StoreIcon className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-heading font-semibold">Are you a professional?</span>
          <span className="block text-small opacity-90">Get a booking page and calendar, free.</span>
        </span>
        <ChevronRightIcon className="shrink-0" />
      </Link>
    </>
  );
}

function Section({ title, id, href, children }: { title: string; id: string; href?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-title font-bold tracking-tight">
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-small font-semibold text-primary">
            See all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
