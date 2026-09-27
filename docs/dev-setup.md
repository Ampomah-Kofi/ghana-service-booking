# Development Setup & Delivery

> Phase 0 plan. Nothing here is installed yet. Phase 1 creates it. `docs/env.md` and `docs/testing.md` (required by CLAUDE.md) will be split out of this file in Phase 1.

## 1. Repository structure

```
.
├── CLAUDE.md
├── docs/
│   ├── SPEC.md  product.md  architecture.md  data-model.md  design.md  roadmap.md  dev-setup.md
│   ├── decisions/                 # ADRs
│   ├── api/                       # /api/v1 docs (OpenAPI generated from Zod)
│   ├── env.md  testing.md         # Phase 1
├── supabase/
│   ├── config.toml                # local stack config (auth.sms.test_otp, hooks, storage buckets)
│   ├── migrations/                # <timestamp>_<name>.sql — the only way the schema changes
│   ├── seed.sql                   # reference data + demo businesses (local/staging only)
│   └── tests/                     # pgTAP: rls/, booking/, constraints/
├── src/
│   ├── app/
│   │   ├── (public)/              # home, search, /business/[slug], category pages
│   │   ├── (customer)/            # /me/appointments, favorites
│   │   ├── (provider)/            # /dashboard, /calendar, onboarding wizard
│   │   ├── (admin)/               # /admin
│   │   ├── api/v1/                # mobile/public API (route handlers → src/server)
│   │   ├── api/internal/          # jobs/dispatch, auth/send-sms, webhooks/payments/[provider]
│   │   └── dev/                   # mock-pay, outbox (404 unless APP_ENV != production)
│   ├── components/                # small, presentational (ui/, booking/, calendar/…)
│   ├── server/                    # ALL business logic ('server-only')
│   │   ├── auth/                  # session helpers, role guards
│   │   ├── db/                    # supabase clients (user-scoped), generated types
│   │   ├── privileged/            # service-key client: lint-restricted imports
│   │   ├── scheduling/            # availability.ts (pure) + tests
│   │   ├── booking/  businesses/  services/  staff/  reviews/  search/  analytics/  admin/
│   │   ├── payments/              # provider.ts, mock.ts, cash.ts, state-machine.ts
│   │   ├── notifications/         # provider.ts, mock-*.ts, templates/, dispatcher.ts
│   │   └── jobs/
│   ├── lib/                       # shared, isomorphic: money.ts, phone.ts, time.ts, errors.ts
│   └── schemas/                   # Zod schemas shared by forms + route handlers
├── tests/
│   ├── integration/               # Vitest against local Supabase (services + RLS via real JWTs)
│   ├── concurrency/               # parallel booking races
│   └── e2e/                       # Playwright critical flows
├── .github/workflows/ci.yml
└── package.json  pnpm-lock.yaml  tsconfig.json  eslint.config.mjs  tailwind config  vitest.config.ts  playwright.config.ts
```

## 2. Environment variables

> **Current, authoritative list: [`env.md`](./env.md).** The table below was the Phase 0 plan and includes variables for later phases.

Rule: `NEXT_PUBLIC_*` is shipped to browsers, so **never** put a secret there. Server-only values are read through a Zod-validated `src/server/env.ts` that imports `server-only` and fails fast at boot.

| Name | Purpose | Scope | Example (local) |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs for share links, QR codes, OAuth redirects | public | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | public | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client key (the older "anon" key); safe because RLS applies | public | *(printed by `supabase status`)* |
| `SUPABASE_SECRET_KEY` | Service-role key. **Only** `src/server/privileged` | **server** | *(printed by `supabase status`)* |
| `SUPABASE_DB_URL` | Direct Postgres URL for tests/scripts only (never the app) | server/CI | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `APP_ENV` | `local` \| `staging` \| `production`; gates mocks and dev routes | server | `local` |
| `PAYMENTS_PROVIDER` | `mock` \| `<vendor>`; `mock` refused when `APP_ENV=production` | server | `mock` |
| `PAYMENTS_WEBHOOK_SECRET` | HMAC secret for inbound payment webhooks (mock uses it too) | server | `dev-only-change-me` |
| `SMS_PROVIDER` / `WHATSAPP_PROVIDER` / `EMAIL_PROVIDER` | Channel provider selection | server | `mock` |
| `SEND_SMS_HOOK_SECRET` | Verifies Supabase Auth → our SMS hook calls | server | `v1,whsec_…` (from Supabase) |
| `CRON_SECRET` | Bearer secret pg_cron uses to call `/api/internal/jobs/*` | server | `dev-cron-secret` |
| `DEFAULT_COUNTRY_CODE` | Phone parsing default region; country data lives in the DB | server | `GH` |
| `SENTRY_DSN` | Error reporting (Phase 11) | server | *(empty)* |
| *Vendor keys (later)* | e.g. `SMS_<VENDOR>_API_KEY`, `PAYMENTS_<VENDOR>_SECRET_KEY`, added only when a real provider is integrated | server | — |

`.env.example` is committed. `.env.local` is gitignored. CI fails if a server-only name appears in a `NEXT_PUBLIC_` variable or in the client bundle.

## 3. Local development

**Prerequisites:** Node 22 LTS, pnpm 10 (via Corepack), Docker (Docker Desktop, OrbStack or Colima). The Supabase CLI is a dev dependency (`pnpm exec supabase`), so there's nothing to install globally.

```bash
pnpm install
cp .env.example .env.local                  # fill keys from `pnpm exec supabase status`
cp supabase/.env.example supabase/.env      # same SEND_SMS_HOOK_SECRET as .env.local
pnpm db:start                               # Postgres, Auth, Storage, Studio in Docker; applies migrations + seed
pnpm dev                                    # http://localhost:3000 · Studio http://127.0.0.1:54323
```

- If image pulls fail with `403` from `public.ecr.aws`, run `export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` first.
- `pnpm db:reset` re-applies all migrations and `supabase/seed.sql`. `pnpm gen:types` regenerates `src/server/db/types.ts` after a schema change (CI fails if you forget).
- **Sign in locally:** the seed phones `+233 20 000 0001…0006` and `…0009` (admin) use the fixed code **123456** (`[auth.sms.test_otp]`). Any other number goes through the Send SMS Hook to `MockSmsProvider`, which prints the code in the `pnpm dev` terminal. This needs the dev server running, because the Auth container calls `host.docker.internal:3000`.
- **Demo appointments:** `pnpm db:demo` (after `pnpm db:reset`) adds a week of bookings for `kwame-cuts` and `ama-braids`, relative to today, so Today and the calendar have something to show. It's separate from `seed.sql` so tests stay deterministic.
- **Seed data:** GHS; Ghana and its 16 regions; Accra, Tema, Kumasi, Takoradi, Cape Coast, Tamale plus 39 neighbourhoods; the 17 SPEC categories; demo tenants `kwame-cuts` (solo, published), `ama-braids` (team, published), `osu-glow-spa` (team, draft) with owner/manager/staff/customer/admin users (see the header of `supabase/seed.sql`). Staging uses the same seed; production gets reference data only.
- `supabase/drafts/0000_initial_schema.draft.sql` is the Phase 0 design for tables not migrated yet. It is never applied.

## 4. Environments & deployment

| Env | Web | Database | Data | Mocks |
|---|---|---|---|---|
| Local | `pnpm dev` | Supabase CLI (Docker) | seed | yes |
| Preview (per PR) | Vercel preview deploy | **staging** Supabase project (shared) | seed | yes |
| Staging | Vercel `staging` branch/domain | Supabase project `…-staging` | seed + test data | yes (plus vendor sandboxes when available) |
| Production | Vercel production | Supabase project `…-prod` (PITR when affordable) | real | **refused at boot** |

- **Migrations flow:** write SQL in `supabase/migrations`, then `supabase db reset` locally, then pgTAP + tests, then PR (CI runs everything on a fresh local stack), then merge to `main`. A GitHub Action runs `supabase db push` to **staging**. A tagged release (`v*`) runs `supabase db push` to **production** after manual approval (GitHub Environment protection), then Vercel promotes.
- **Migration safety:** additive first (expand → migrate → contract); no destructive change in the same release that stops using a column; every migration reviewed for RLS on new tables (CI check: fails if any `public` table has RLS disabled).
- **Why previews share staging instead of Supabase Branching:** Branching costs extra and adds per-PR DBs we don't need yet. Risk: schema-changing PRs can't be fully previewed until merged to staging. Accepted for a solo developer; revisit with a team.
- **Secrets:** Vercel env vars per environment. Supabase keys never leave server env. Rotation procedure documented in `docs/env.md`.

## 5. Testing strategy

| Layer | Tool | What | When |
|---|---|---|---|
| Unit | Vitest | Pure logic: `availability.ts` (DST, buffers, grid, notice/advance, any-available ordering), money formatting, phone parsing, payment state machine, query parser, Zod schemas | Every commit, < 10 s |
| DB (constraints & functions) | pgTAP via `supabase test db` | Exclusion constraint (overlap/touching/cancelled/buffers), `book_appointment` paths and error codes, `create_blocked_time` vs bookings, status transitions, review eligibility | CI |
| **RLS isolation** | pgTAP | For **every** table: 2 businesses × personas (anon, customer, staff-A, manager-A, owner-A, owner-B, admin) × select/insert/update/delete, asserting the exact row counts/errors. Plus a meta-test that every public table has RLS enabled and at least one policy (or is on an allowlist, e.g. `payment_events`) | CI, required for any new table |
| Integration | Vitest + local Supabase | `src/server` services with real JWTs (sign in seed users), `/api/v1` handlers, webhook idempotency (same event ×3 → one transition), notification outbox and reminders | CI |
| **Concurrency** | Vitest + `pg` pool | 20 parallel `book_appointment` calls on the same slot: 1 staff → exactly 1 success; 3 staff "any" → exactly 3. Block-vs-booking race. Repeated 20 times to shake out flakiness | CI |
| Parity | Vitest | Randomised fixtures: every slot the TS generator offers must be accepted by the SQL booking function (and a sample of rejected ones refused) | CI |
| E2E | Playwright (mobile viewport + desktop) | Guest books with OTP → confirmation; provider onboarding (solo) → publish → public page; provider marks arrived/completed; customer reviews; cancel within/outside window; deposit via mock pay | CI on `main` + before release |
| Accessibility | axe via Playwright | Critical pages have no serious violations | CI |
| Performance | Lighthouse CI (mobile, throttled 3G profile) | Public pages: JS < 200 KB gz in total, our own code < 30 KB, LCP < 2.5 s | Phase 11, then CI |

CI (`.github/workflows/ci.yml`): install → typecheck → lint → unit → `supabase start` → `db reset` → pgTAP → integration + concurrency → build → E2E. Branch protection requires green CI.
