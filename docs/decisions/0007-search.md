# ADR-0007: Search on Postgres (FTS + trigram + PostGIS)

**Status:** Accepted · **Date:** 2026-09-27

## Context

Queries like "Barber in East Legon", "Nails near me", "Braids in Accra". Results need category, area, price, rating and next availability. The corpus starts small (hundreds to low thousands of businesses).

## Decision

- A weighted `tsvector` on businesses (name, categories/keywords, area/city, description), `simple` config + `unaccent`, maintained by triggers.
- `pg_trgm` for fuzzy names and area matching. `categories.search_keywords` for synonyms.
- A lightweight query parser splits "X in Y" / "near me".
- PostGIS `geography` + GiST for distance. Area/city fallback when there are no coordinates.
- A `next_available_at` cache column for cards.

## Alternatives

| Option                              | Pros                                | Cons                                                            |
| ----------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| Meilisearch / Typesense             | Great typo tolerance, facets, speed | Another service to host, sync and secure; overkill at MVP scale |
| Algolia                             | Hosted, excellent                   | Cost per search; vendor lock-in                                 |
| Supabase pgvector / semantic search | Handles vague intent                | Embedding cost; not needed for structured queries               |

## Consequences

- No extra infrastructure. Search respects RLS automatically (published rows only).
- **Revisit when:** p95 > 300 ms, facet counts are required, listings exceed ~200k, or multi-language synonyms get complex. Then add Typesense/Meilisearch fed from an outbox.
