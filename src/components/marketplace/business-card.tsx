import Link from "next/link";
import { ViewTransition } from "react";
import { publicMediaUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import type { BusinessCard as Card } from "@/server/search/marketplace";
import { Cover } from "./cover";
import { FavoriteButton } from "./favorite-button";

type Currency = { code: string; symbol: string; minorUnit: number };

/**
 * Result card (SPEC §11): photo first, then name, rating (or "New"), category · area,
 * and the starting price. `compact` is the narrower card used in horizontal rows; `row` is the
 * phone-friendly list layout used for search results (small picture left, details right).
 */
export function BusinessCard({
  card,
  supabaseUrl,
  currencies,
  compact = false,
  row = false,
  eager = false,
  next = null,
  morph = true,
  favorite,
}: {
  card: Card;
  supabaseUrl: string;
  currencies: Map<string, Currency>;
  compact?: boolean;
  row?: boolean;
  eager?: boolean;
  /** "Today 2:30 pm" when there's still a free time today (SPEC §11: next available). */
  next?: string | null;
  /** Grow this cover into the business page's cover on tap. Only one card per business on a page may morph. */
  morph?: boolean;
  /** Heart on the cover: true/false = saved or not; null = signed out (heart goes to sign-in); undefined = no heart. */
  favorite?: boolean | null;
}) {
  const image = card.imagePath ?? card.logoPath;
  const currency = card.startingPrice ? currencies.get(card.startingPrice.currency) : undefined;
  const price =
    card.startingPrice && currency
      ? formatMoney({ amountMinor: card.startingPrice.amountMinor, currency: card.startingPrice.currency }, currency)
      : null;
  const meta = [card.categoryName, card.place, card.distanceKm !== null ? `${card.distanceKm} km` : null]
    .filter(Boolean)
    .join(" · ");

  const rating = card.rating ? (
    <span className="shrink-0 text-small font-semibold tabular-nums">
      <span className="text-star" aria-hidden="true">
        ★
      </span>{" "}
      {card.rating.average.toFixed(1)} <span className="font-normal text-ink-muted">({card.rating.count})</span>
    </span>
  ) : null;
  const priceLine = (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-small">
      {price ? (
        <span>
          From <span className="font-semibold tabular-nums">{price}</span>
        </span>
      ) : (
        <span className="text-ink-muted">Prices on request</span>
      )}
      {next ? (
        <span className="inline-flex items-center gap-1 font-medium text-success">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          {next}
        </span>
      ) : null}
    </p>
  );
  const heart =
    favorite !== undefined ? (
      <FavoriteButton
        businessId={card.id}
        businessName={card.name}
        saved={favorite}
        className={row ? "absolute top-1.5 right-1.5 text-ink-muted" : "glass absolute top-2 right-2 text-ink"}
      />
    ) : null;

  if (row) {
    return (
      <div className="relative">
        <Link
          href={`/business/${card.slug}`}
          className="pressable group flex items-center gap-3 rounded-card bg-card p-2.5 lift"
        >
          <MorphCover id={card.id} enabled={morph}>
            <div className="relative size-22 shrink-0 overflow-hidden rounded-control bg-fill">
              <Cover
                imageUrl={image ? publicMediaUrl(supabaseUrl, image) : null}
                categorySlug={card.categorySlug}
                seed={card.id}
                iconScale={0.8}
                eager={eager}
              />
            </div>
          </MorphCover>
          <div className={`min-w-0 flex-1 py-0.5 ${heart ? "pr-9" : "pr-1"}`}>
            <h3 className="truncate text-heading font-semibold">{card.name}</h3>
            {meta ? <p className="truncate text-small text-ink-muted">{meta}</p> : null}
            <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-small">
              {rating ?? (
                <span className="rounded-full bg-primary-soft px-1.5 text-caption font-semibold text-primary">New</span>
              )}
              {price ? (
                <span>
                  From <span className="font-semibold tabular-nums">{price}</span>
                </span>
              ) : (
                <span className="text-ink-muted">Prices on request</span>
              )}
            </p>
            {next ? (
              <p className="mt-0.5 inline-flex items-center gap-1 text-small font-medium text-success">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
                {next}
              </p>
            ) : null}
          </div>
        </Link>
        {heart}
      </div>
    );
  }

  return (
    <div className="relative">
      <Link href={`/business/${card.slug}`} className="pressable group block">
        <MorphCover id={card.id} enabled={morph}>
          <div className={`relative overflow-hidden rounded-card bg-fill ${compact ? "aspect-3/2" : "aspect-video"}`}>
            <Cover
              imageUrl={image ? publicMediaUrl(supabaseUrl, image) : null}
              categorySlug={card.categorySlug}
              seed={card.id}
              iconScale={compact ? 0.9 : 1}
              eager={eager}
              className="transition-transform duration-300 group-hover:scale-102"
            />
            {card.rating ? null : (
              <span className="glass absolute top-2.5 left-2.5 rounded-full px-2.5 py-1 text-caption font-semibold text-ink">
                New
              </span>
            )}
          </div>
        </MorphCover>
        <div className="px-0.5 pt-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate text-heading font-semibold">{card.name}</h3>
            {rating}
          </div>
          {meta ? <p className="truncate text-small text-ink-muted">{meta}</p> : null}
          {priceLine}
        </div>
      </Link>
      {heart}
    </div>
  );
}

/** Shared-element transition into the business page cover (ADR-0012); plain content when off. */
export function MorphCover({
  id,
  enabled = true,
  children,
}: {
  id: string;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return children;
  return (
    <ViewTransition name={`cover-${id}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
