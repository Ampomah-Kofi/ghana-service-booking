import type { Metadata } from "next";
import { heartsFor } from "@/server/favorites/favorites";
import { getCurrentUser } from "@/server/auth/session";
import { EmptyState } from "@/components/ui/empty-state";
import { StoreIcon } from "@/components/ui/icons";
import { LargeTitle } from "@/components/ui/large-title";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultList } from "@/components/marketplace/result-list";
import { publicEnv } from "@/lib/public-env";
import { listActiveCategories } from "@/server/catalog/categories";
import { listCities, listCurrencies } from "@/server/catalog/currencies";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
import { nextAvailableToday } from "@/server/scheduling/next-available";
import { searchMarketplace } from "@/server/search/marketplace";

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = (await listActiveCategories(await createUserClient())).find((c) => c.slug === slug);
  return category
    ? {
        title: category.name,
        description: `Book ${category.name.toLowerCase()} near you. Compare prices and book online.`,
      }
    : { title: "Not found" };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const { town } = await searchParams;
  const db = await createUserClient();
  const country = serverEnv().DEFAULT_COUNTRY_CODE;
  const category = (await listActiveCategories(db)).find((c) => c.slug === slug);
  if (!category) notFound();
  const where = typeof town === "string" ? town.slice(0, 60) : "";

  const [result, cities, currencies] = await Promise.all([
    searchMarketplace(db, { categorySlug: slug, where, pageSize: 30 }, country),
    listCities(db, country),
    listCurrencies(db),
  ]);

  const user = await getCurrentUser();
  const ids = result.results.map((c) => c.id);
  const [next, favorites] = await Promise.all([nextAvailableToday(db, ids), heartsFor(db, user?.id ?? null, ids)]);
  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-full px-3.5 text-small whitespace-nowrap ${active ? "bg-ink text-surface" : "bg-fill text-ink"}`;

  return (
    <>
      <LargeTitle title={category.name} className="" />
      <p className="mb-4 mt-1 text-small text-ink-muted">
        {result.total === 1 ? "1 professional" : `${result.total} professionals`}
        {result.interpretation.place ? ` in ${result.interpretation.place}` : ""}
      </p>
      <nav aria-label="Filter by town" className="-mx-5 mb-5 overflow-x-auto px-5 [scrollbar-width:none]">
        <ul className="flex w-max gap-2">
          <li>
            <Link href={`/categories/${slug}`} className={chip(!where)} aria-current={!where ? "page" : undefined}>
              Everywhere
            </Link>
          </li>
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/categories/${slug}?town=${encodeURIComponent(c.name)}`}
                className={chip(where === c.name)}
                aria-current={where === c.name ? "page" : undefined}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {result.notice ? (
        <p role="status" className="mb-4 rounded-control bg-fill px-3 py-2 text-small">
          {result.notice}
        </p>
      ) : null}
      {result.results.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title={`No ${category.name.toLowerCase()} yet`}
          body="New professionals join every week."
          action={{ href: "/onboarding", label: "Are you one? List your business" }}
        />
      ) : (
        <ResultList
          cards={result.results}
          supabaseUrl={publicEnv().NEXT_PUBLIC_SUPABASE_URL}
          currencies={currencies}
          next={next}
          favorites={favorites}
        />
      )}
    </>
  );
}
