import "server-only";
import type { Suggestion } from "@/components/marketplace/search-field";
import type { Db } from "@/server/db/client";
import { listActiveCategories } from "./categories";
import { listCities } from "./currencies";

/** Categories and towns for the search field's instant suggestions (reference data, no user data). */
export function toSuggestions(categories: { name: string; slug: string }[], cities: { name: string }[]): Suggestion[] {
  return [
    ...categories.map((c) => ({ label: c.name, href: `/categories/${c.slug}`, kind: "category" as const })),
    ...cities.map((c) => ({
      label: c.name,
      href: `/search?where=${encodeURIComponent(c.name)}`,
      kind: "town" as const,
    })),
  ];
}

export async function searchSuggestions(db: Db, countryCode: string): Promise<Suggestion[]> {
  const [categories, cities] = await Promise.all([listActiveCategories(db), listCities(db, countryCode)]);
  return toSuggestions(categories, cities);
}
