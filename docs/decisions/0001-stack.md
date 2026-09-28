# ADR-0001: Stack, hosting and data access

**Status:** Accepted · **Date:** 2026-09-27

## Context

One developer, mobile-first web MVP, Ghana users on variable bandwidth, a future native app, and strict tenant isolation. CLAUDE.md already fixes Next.js + TypeScript + Tailwind + Supabase + pnpm. Still open: hosting, DB region, how server code talks to Postgres, jobs, and supporting libraries.

## Decision

- **Next.js App Router** on **Vercel**, with functions pinned to the region nearest the DB.
- **Supabase** (Postgres, Auth, Storage) in an **EU-West region**, after a latency check from Accra.
- **Data access:** `supabase-js` acting **as the signed-in user** (RLS always applies) for reads and simple writes. **Postgres functions (RPC)** for transactional/invariant writes. Types from `supabase gen types typescript`. **No ORM** for MVP.
- **Jobs:** Supabase `pg_cron` + `pg_net` calling secret-protected `/api/internal/jobs/*` routes.
- **Libraries:** zod, libphonenumber-js, date-fns + @date-fns/tz, @supabase/ssr, @supabase/supabase-js. Dev: vitest, @playwright/test, eslint, prettier.

## Alternatives

| Option                                        | Pros                                                 | Cons                                                                                                                                         |
| --------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Drizzle/Prisma via direct Postgres connection | Great DX, typed joins                                | Connection runs as a privileged role → RLS bypassed unless each transaction sets `role` + JWT claims. One missed wrapper = cross-tenant leak |
| Drizzle _only_ for migrations/types           | Typed schema                                         | Two sources of truth next to Supabase SQL migrations                                                                                         |
| Fly.io / Render (Docker)                      | Region choice (e.g. Johannesburg), no vendor lock-in | Ops work: images, scaling, TLS, previews                                                                                                     |
| Vercel Cron / Inngest for jobs                | Nice UIs                                             | Per-minute cron needs a paid Vercel plan; Inngest adds a vendor                                                                              |
| Supabase `af-south-1`                         | In Africa                                            | Accra ↔ Cape Town traffic often routes via Europe; measure before choosing                                                                   |

## Consequences

- RLS is structurally hard to bypass by accident. Complex queries become SQL views/functions (more SQL in migrations, which pgTAP tests well).
- Moving off Vercel later is feasible (standard Next.js). Moving off Supabase means replacing Auth + Storage (a larger job, accepted).
- Latency: every request is one hop Vercel→Supabase in the same region. Public pages are cached.
