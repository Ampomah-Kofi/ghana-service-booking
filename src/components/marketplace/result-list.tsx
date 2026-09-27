import { BusinessCard } from "./business-card";
import type { BusinessCard as Card } from "@/server/search/marketplace";
import type { CurrencyView } from "@/server/catalog/currencies";

export function ResultList({
  cards,
  supabaseUrl,
  currencies,
}: {
  cards: Card[];
  supabaseUrl: string;
  currencies: Map<string, CurrencyView>;
}) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <li key={card.id} className="min-w-0">
          <BusinessCard card={card} supabaseUrl={supabaseUrl} currencies={currencies} />
        </li>
      ))}
    </ul>
  );
}
