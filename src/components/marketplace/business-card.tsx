import Link from "next/link";
import { publicMediaUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import type { BusinessCard as Card } from "@/server/search/marketplace";
import { Cover } from "./cover";

type Currency = { code: string; symbol: string; minorUnit: number };

/**
 * Result card (SPEC §11): photo first, then name, rating (or "New"), category · area,
 * and the starting price. `compact` is the narrower card used in horizontal rows.
 */
export function BusinessCard({
  card,
  supabaseUrl,
  currencies,
  compact = false,
  eager = false,
}: {
  card: Card;
  supabaseUrl: string;
  currencies: Map<string, Currency>;
  compact?: boolean;
  eager?: boolean;
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

  return (
    <Link href={`/business/${card.slug}`} className="pressable group block">
      <div className={`relative overflow-hidden rounded-card bg-fill ${compact ? "aspect-4/3" : "aspect-video"}`}>
        <Cover
          imageUrl={image ? publicMediaUrl(supabaseUrl, image) : null}
          categorySlug={card.categorySlug}
          seed={card.id}
          iconScale={compact ? 0.9 : 1}
          eager={eager}
          className="transition-transform duration-300 group-hover:scale-102"
        />
        {card.rating ? null : (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-card/95 px-2.5 py-1 text-caption font-semibold text-primary">
            New
          </span>
        )}
      </div>
      <div className="px-0.5 pt-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-heading font-semibold">{card.name}</h3>
          {card.rating ? (
            <span className="shrink-0 text-small font-semibold tabular-nums">
              <span className="text-star" aria-hidden="true">
                ★
              </span>{" "}
              {card.rating.average.toFixed(1)} <span className="font-normal text-ink-muted">({card.rating.count})</span>
            </span>
          ) : null}
        </div>
        {meta ? <p className="truncate text-small text-ink-muted">{meta}</p> : null}
        {price ? (
          <p className="mt-0.5 text-small">
            From <span className="font-semibold tabular-nums">{price}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
