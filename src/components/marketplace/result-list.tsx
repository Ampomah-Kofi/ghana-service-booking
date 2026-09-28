import { BusinessCard } from "./business-card";
import type { BusinessCard as Card } from "@/server/search/marketplace";
import type { CurrencyView } from "@/server/catalog/currencies";

export function ResultList({
  cards,
  supabaseUrl,
  currencies,
  next,
  favorites,
}: {
  cards: Card[];
  supabaseUrl: string;
  currencies: Map<string, CurrencyView>;
  next?: Map<string, { label: string }>;
  /** Saved businesses of the signed-in user; null = signed out; undefined = no hearts. */
  favorites?: Set<string> | null;
}) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-6 sm:grid-cols-2">
      {cards.map((card, i) => (
        <li key={card.id} className="min-w-0">
          <BusinessCard
            card={card}
            supabaseUrl={supabaseUrl}
            currencies={currencies}
            eager={i < 2}
            next={next?.get(card.id)?.label}
            favorite={favorites === undefined ? undefined : favorites === null ? null : favorites.has(card.id)}
          />
        </li>
      ))}
    </ul>
  );
}
