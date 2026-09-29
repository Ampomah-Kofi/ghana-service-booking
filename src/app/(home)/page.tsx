import Link from "next/link";
import { unreadCount } from "@/server/notifications/inbox";
import { NotificationBell } from "@/components/ui/notification-bell";
import { Toast } from "@/components/ui/toast";
import { heartsFor } from "@/server/favorites/favorites";
import { toSuggestions } from "@/server/catalog/suggestions";
import { LargeTitle } from "@/components/ui/large-title";
import type { ReactNode } from "react";
import { BusinessCard } from "@/components/marketplace/business-card";
import { Cover } from "@/components/marketplace/cover";
import { SearchForm } from "@/components/marketplace/search-form";
import { ChevronRightIcon, StoreIcon } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";
import { publicEnv } from "@/lib/public-env";
import { listActiveCategories } from "@/server/catalog/categories";
import { countryTimezone, listCities, listCurrencies } from "@/server/catalog/currencies";
import { formatDayLong } from "@/lib/datetime";
import { UserIcon } from "@/components/ui/icons";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
import { getCurrentUser } from "@/server/auth/session";
import { listMyPlaces } from "@/server/bookings/places";
import { nextAvailableToday } from "@/server/scheduling/next-available";
import { recentlyJoined, type BusinessCard as Card } from "@/server/search/marketplace";
import { PlaceCard } from "@/components/marketplace/place-card";

const EXAMPLES = [
  "Barber in East Legon",
  "Electrician in Tema",
  "Braids in Kumasi",
  "DJ in Accra",
  "Nails near me",
  "Home cleaning",
];

/** Explore: search first, then categories and swipeable rows of providers (SPEC §11). */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const deleted = (await searchParams).deleted === "1";
  const db = await createUserClient();
  const user = await getCurrentUser();
  const country = serverEnv().DEFAULT_COUNTRY_CODE;
  const [categories, cities, recent, currencies, places, timezone] = await Promise.all([
    listActiveCategories(db),
    listCities(db, country),
    recentlyJoined(db, 40),
    listCurrencies(db),
    user ? listMyPlaces(db, user.id) : Promise.resolve([]),
    countryTimezone(db, country),
  ]);
  // Live "next free time today" for everything shown, in one batch (same engine as booking).
  const ids = recent.map((c) => c.id);
  const unread = user ? await unreadCount(db) : 0;
  const [next, favorites] = await Promise.all([nextAvailableToday(db, ids), heartsFor(db, user?.id ?? null, ids)]);
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

  // A business can appear in several rows; only its first card may morph into the page cover.
  const morphed = new Set<string>();
  const firstShown = (id: string) => (morphed.has(id) ? false : (morphed.add(id), true));
  const row = (cards: Card[], eagerFirst = false) => (
    <ul className="rail -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
      {cards.map((card, i) => (
        <li key={card.id} className="w-[64%] max-w-64 shrink-0">
          <BusinessCard
            card={card}
            supabaseUrl={supabaseUrl}
            currencies={currencies}
            compact
            eager={eagerFirst && i < 2}
            next={next.get(card.id)?.label}
            morph={firstShown(card.id)}
            favorite={favorites === null ? null : favorites.has(card.id)}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="relative isolate">
      {deleted ? <Toast message="Your account has been deleted" param="deleted" /> : null}
      <div className="hero bleed-top -mx-5 mb-7 rounded-b-[28px] px-5 pt-safe pb-5 md:mx-0 md:mt-0 md:rounded-[28px] md:pt-5">
        <LargeTitle
          title="Explore"
          eyebrow={formatDayLong(new Date(), timezone)}
          className="mb-1"
          onColor
          trailing={
            <div className="mb-0.5 flex items-center gap-2">
              {user ? <NotificationBell unread={unread} className="bg-white/16 text-white" /> : null}
              <Link
                href={user ? "/account" : "/sign-in"}
                aria-label={user ? "Your account" : "Sign in"}
                className="pressable flex size-10 shrink-0 items-center justify-center rounded-full bg-white/16 text-white"
              >
                <UserIcon className="size-5" />
              </Link>
            </div>
          }
        />
        <p className="hero-muted mb-4 text-body">Book barbers, braiders, electricians, DJs and more near you.</p>

        <section aria-label="Search">
          <SearchForm suggestions={toSuggestions(categories, cities)} />
          <ul className="rail -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
            {EXAMPLES.map((example) => (
              <li key={example} className="shrink-0">
                <Link
                  href={`/search?q=${encodeURIComponent(example)}`}
                  className="pressable inline-flex min-h-9 items-center rounded-full bg-white/14 px-3.5 text-small text-white ring-1 ring-white/20 ring-inset"
                >
                  {example}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {places.length > 0 ? (
        <Section title="Your places" id="places">
          <ul className="rail -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {places.map((place) => (
              <li key={place.businessId} className="w-[64%] max-w-64 shrink-0">
                <PlaceCard place={place} supabaseUrl={supabaseUrl} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Categories" id="categories">
        {categories.length === 0 ? (
          <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">No categories yet. Check back soon.</p>
        ) : (
          <ul className="rail -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
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
        <p className="mb-8 rounded-card bg-card p-5 text-body text-ink-muted lift">
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
                className="pressable inline-flex min-h-10 items-center rounded-full bg-fill px-4 text-small font-medium"
              >
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Link href="/onboarding" className="hero pressable mb-4 flex items-center gap-4 overflow-hidden rounded-card p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <StoreIcon className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-heading font-semibold">Are you a professional?</span>
          <span className="hero-muted block text-small">Get a booking page and calendar, free.</span>
        </span>
        <ChevronRightIcon className="shrink-0" />
      </Link>
    </div>
  );
}

function Section({ title, id, href, children }: { title: string; id: string; href?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-title font-bold">
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-body text-primary">
            See all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
