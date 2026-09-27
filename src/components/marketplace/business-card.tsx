import Link from "next/link";
import { publicMediaUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import type { BusinessCard as Card } from "@/server/search/marketplace";

type Currency = { code: string; symbol: string; minorUnit: number };

/** Result card (SPEC §11): name, image, category, area, starting price, rating, next slot. */
export function BusinessCard({
  card,
  supabaseUrl,
  currencies,
}: {
  card: Card;
  supabaseUrl: string;
  currencies: Map<string, Currency>;
}) {
  const image = card.imagePath ?? card.logoPath;
  const currency = card.startingPrice ? currencies.get(card.startingPrice.currency) : undefined;
  return (
    <Link
      href={`/business/${card.slug}`}
      className="group flex gap-3 rounded-card bg-card p-3 border border-border transition-colors hover:bg-fill"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized 400px rendition from upload
        <img
          src={publicMediaUrl(supabaseUrl, image)}
          alt=""
          width={88}
          height={88}
          loading="lazy"
          className="size-22 shrink-0 rounded-control object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-22 shrink-0 items-center justify-center rounded-control bg-primary/10 text-display font-bold text-primary"
        >
          {card.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="truncate text-body font-semibold">{card.name}</span>
        <span className="truncate text-small text-ink-muted">
          {[card.categoryName, card.place].filter(Boolean).join(" · ")}
          {card.distanceKm !== null ? ` · ${card.distanceKm} km` : ""}
        </span>
        <span className="flex items-center gap-2 text-small tabular-nums">
          {card.startingPrice && currency ? (
            <span className="font-medium">
              From{" "}
              {formatMoney(
                { amountMinor: card.startingPrice.amountMinor, currency: card.startingPrice.currency },
                currency,
              )}
            </span>
          ) : null}
          {card.rating ? (
            <span className="text-ink-muted">
              ★ {card.rating.average.toFixed(1)} ({card.rating.count})
            </span>
          ) : (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">New</span>
          )}
        </span>
      </span>
    </Link>
  );
}
