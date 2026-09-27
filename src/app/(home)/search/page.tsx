import type { Metadata } from "next";
import Link from "next/link";
import { ResultList } from "@/components/marketplace/result-list";
import { SearchForm } from "@/components/marketplace/search-form";
import { NearMeButton } from "@/components/marketplace/near-me-button";
import { publicEnv } from "@/lib/public-env";
import { parseCoordinates } from "@/lib/search-query";
import { listCurrencies } from "@/server/catalog/currencies";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
import { searchMarketplace } from "@/server/search/marketplace";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const p = await searchParams;
  const label = [one(p.q), one(p.where)].filter(Boolean).join(" in ");
  return { title: label ? `${label}` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const p = await searchParams;
  const q = one(p.q).slice(0, 100);
  const where = one(p.where).slice(0, 60);
  const page = Math.max(1, Number.parseInt(one(p.page), 10) || 1);
  const coords = parseCoordinates(one(p.near));

  const db = await createUserClient();
  const [result, currencies] = await Promise.all([
    searchMarketplace(db, { q, where, coords, page, pageSize: 20 }, serverEnv().DEFAULT_COUNTRY_CODE),
    listCurrencies(db),
  ]);
  const { interpretation: i } = result;
  const heading = [
    i.category?.name ?? (i.text ? `“${i.text}”` : "Everything"),
    coords ? "near you" : i.place ? `in ${i.place}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const pages = Math.ceil(result.total / result.pageSize);
  const pageHref = (n: number) =>
    `/search?${new URLSearchParams({ ...(q && { q }), ...(where && { where }), ...(one(p.near) && { near: one(p.near) }), page: String(n) })}`;

  return (
    <>
      <div className="mb-5">
        <SearchForm defaultQuery={[q, where && !q.includes(" in ") ? `in ${where}` : ""].filter(Boolean).join(" ")} />
      </div>

      <h1 className="text-display font-bold tracking-tight">{heading}</h1>
      <p className="mb-4 text-small text-ink-muted" aria-live="polite">
        {result.total === 1 ? "1 result" : `${result.total} results`}
      </p>

      {result.needsLocation ? (
        <div className="mb-4 rounded-card bg-card p-4 border border-border">
          <p className="text-body">Allow location to see who&apos;s closest to you.</p>
          <NearMeButton query={q} />
        </div>
      ) : null}
      {result.notice ? (
        <p role="status" className="mb-4 rounded-control bg-fill px-3 py-2 text-small">
          {result.notice}
        </p>
      ) : null}

      {result.results.length === 0 ? (
        <div className="rounded-card bg-card p-6 text-center border border-border">
          <p className="text-title font-semibold">No matches yet</p>
          <p className="mt-2 text-body text-ink-muted">
            Try a category like “barber” or “nails”, or a bigger town like Accra or Kumasi.
          </p>
          <Link href="/" className="mt-3 inline-flex min-h-11 items-center font-medium text-primary">
            Browse all categories
          </Link>
        </div>
      ) : (
        <ResultList cards={result.results} supabaseUrl={publicEnv().NEXT_PUBLIC_SUPABASE_URL} currencies={currencies} />
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className="min-h-11 content-center font-medium text-primary">
              ‹ Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-small text-ink-muted">
            Page {result.page} of {pages}
          </span>
          {result.page < pages ? (
            <Link href={pageHref(result.page + 1)} className="min-h-11 content-center font-medium text-primary">
              Next ›
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
