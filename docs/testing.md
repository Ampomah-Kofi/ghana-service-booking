# Testing

| Command | What it runs | Needs |
|---|---|---|
| `pnpm test` | Vitest unit tests (`tests/unit/**`) | nothing |
| `pnpm test:db` | pgTAP tests (`supabase/tests/database/*.test.sql`) via `supabase test db` | local Supabase running (`pnpm db:start`) |
| `pnpm test:integration` | Vitest against the local stack: `src/server` services with a real signed-in user, so RLS applies (`tests/integration/**`) | local Supabase + `.env.local` |
| `pnpm test:e2e` | Playwright, Pixel 7 viewport, against `pnpm start` (build first) (`tests/e2e/**`) | local Supabase, a build, a Chromium (`pnpm exec playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`) |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` | nothing |
| `pnpm lint` | ESLint, zero warnings allowed (includes the privileged-import ban) | nothing |
| `pnpm format:check` | Prettier on code files | nothing |
| `pnpm build && pnpm check:secrets` | Production build, then scans `.next/static` for secret prefixes and values | env vars |

CI (`.github/workflows/ci.yml`) runs all of these on every PR, plus a check that `src/server/db/types.ts` matches the schema.

## Database tests (pgTAP)

- Each file runs in one transaction that is **rolled back**, so tests never leave data behind.
- They rely on the **seed fixtures** in `supabase/seed.sql` (fixed UUIDs: users `a0000000-…-00000000000N`, businesses `b0000000-…`). If you change the seed, update the tests.
- Personas are simulated with `pg_temp.act_as(uuid | null)`, which sets `role` (`anon`/`authenticated`) and `request.jwt.claims`. That's exactly what PostgREST does per request, so `auth.uid()` and RLS behave as in production.

| File | Covers |
|---|---|
| `00_rls_coverage` | Meta-rules: RLS on every `public` table; every table has a policy (or is allowlisted); every `SECURITY DEFINER` function pins `search_path`; column-level update grants |
| `01_reference_data` | Public read, no client writes, inactive categories hidden |
| `02_identity` | Profile bootstrap trigger and phone sync; self-only profiles; protected columns; append-only consents; admin list visibility |
| `04_business_profile_isolation` | Public vs member reads, cross-tenant writes and column protection on categories, locations, booking rules, staff, photos; location hierarchy, photo-path and 12-photo constraints |
| `05_onboarding_functions` | `create_business` (atomic, slugs, reserved words, non-ASCII names, 5-business limit), readiness, publish/unpublish, slug lock after publish, authorization, suspended businesses |
| `06_storage_policies` | Uploads only into your own `businesses/{id}/{logo|photos|staff}/` folder; no staff, anon or cross-tenant writes/deletes |
| `07_catalog_isolation` | Services (inactive/draft hidden), staff↔service links, hours, blocked times (private reasons), invites, audit log: public vs member vs cross-tenant, direct writes refused |
| `08_schedule_team_functions` | Week hours (split shifts, midnight, overlap, 5-min steps, atomic replace), staff hours, cross-tenant assignment refused, time off in the business timezone (incl. a DST day in Europe/London), staff self-service limits, invite → accept (forwarded link to another phone refused, one use), owner-only manager invites, removing staff revokes access |
| `09_admin_categories` | Only super admins; reason required; create/update audit-logged with before/after; moderators refused |
| `03_business_isolation` | **Tenant isolation**: 6 personas × read/update/insert/delete on `businesses` and `business_members`; draft/suspended visibility; column protection; helper functions; slug/timezone constraints |

**Rule (CLAUDE.md):** every new table ships with a test proving Business A cannot read or write Business B's rows. Adding a table without a policy makes `00_rls_coverage` fail.

**The tests are known to bite:** in Phase 1 a deliberately leaky policy on `business_members` plus RLS disabled on `consents` produced 7 failures across three files, and all passed again after reverting.

## Unit tests

| File | Covers |
|---|---|
| `phone.test.ts` | Ghanaian formats (`024…`, `+233…`, `233…`), other countries, invalid input |
| `money.test.ts` | Pesewas → display, grouping, negatives, zero-decimal currencies, float rejection |
| `standard-webhooks.test.ts` | Valid/rotated/tampered/foreign-key/stale/missing-header signatures |
| `env.test.ts` | Server env validation, including the **mock-in-production refusal** |
| `safe-return-path.test.ts` | Open-redirect protection for `?next=` |
| `business-schemas.test.ts` | Create/slug/location/contact schemas (city vs unlisted town, coordinate pairs, WhatsApp-same-as-phone) |
| `business-errors.test.ts` | SQLSTATE → AppError mapping (no internal leaks); JPEG/WebP magic-byte sniffing (SVG/PNG rejected) |
| `share.test.ts` | Share, WhatsApp, tel, maps and media URLs |
| `catalog-helpers.test.ts` | Price parsing (GH₵ input → pesewas, rejects `1e3`), week-hours validation, Postgres range parsing, service/time-off schemas, form refill helpers |
| `mock-sms-provider.test.ts` | Mock records and logs messages |

## Integration and end-to-end tests
- Both create a **fresh email/password user per run** through the admin API (secret key; the helpers refuse to run against a non-local Supabase) and delete it, with its businesses and files, afterwards.
- `tests/e2e/onboarding.spec.ts`: sign in → create business → 4 setup steps (including validation errors) → photo resized in the browser and uploaded → publish → public page as a signed-out visitor → QR download → unpublish returns 404.
- `tests/integration/businesses.test.ts`: the same use-cases at the service layer, plus cross-tenant attempts and file-type sniffing.
- `tests/integration/catalog.test.ts`: services (order, hide, archive), hours, time off, booking rules, team members with own hours, a real phone-bound invite accepted by the right user (and refused for another), removal revoking access, admin refusal.

## Known gaps
- The phone OTP sign-in path is not in E2E (needs the SMS hook plus the app running under the Auth container); it's covered by unit tests and a manual check.
- Concurrency tests arrive with booking (Phase 5).
