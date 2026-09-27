import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultList } from "@/components/marketplace/result-list";
import { publicEnv } from "@/lib/public-env";
import { listActiveCategories } from "@/server/catalog/categories";
import { listCities, listCurrencies } from "@/server/catalog/currencies";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
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

  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-full px-3.5 text-small whitespace-nowrap ${active ? "bg-ink text-surface" : "bg-fill text-ink"}`;

  return (
    <>
      <h1 className="text-display font-bold tracking-tight">{category.name}</h1>
      <p className="mb-4 mt-1 text-small text-ink-muted">
        {result.total === 1 ? "1 professional" : `${result.total} professionals`}
        {result.interpretation.place ? ` in ${result.interpretation.place}` : ""}
      </p>
      <nav aria-label="Filter by town" className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none]">
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
        <div className="rounded-card bg-card p-6 text-center border border-border">
          <p className="text-title font-semibold">No {category.name.toLowerCase()} yet</p>
          <p className="mt-2 text-body text-ink-muted">New professionals join every week.</p>
          <Link href="/onboarding" className="mt-3 inline-flex min-h-11 items-center font-medium text-primary">
            Are you one? List your business
          </Link>
        </div>
      ) : (
        <ResultList cards={result.results} supabaseUrl={publicEnv().NEXT_PUBLIC_SUPABASE_URL} currencies={currencies} />
      )}
    </>
  );
}
