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
- Files that count appointments start with `delete from public.appointments` inside their rolled-back transaction, so they pass with or without `pnpm db:demo` data or E2E leftovers.
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
| `10_search` | Query understanding (typos, plurals, missing spaces), the six SPEC §11 examples on seed data, service names searchable, drafts and suspended businesses never returned, live search-document refresh, page-size cap |
| `11_appointments` | Booking rules in the database: sign-in required, overlap refused / touching allowed, closing time, minimum notice, advance window, cross-business and draft refusal, staff eligibility, **"any available" fallback**, time off vs bookings both ways, buffers, **RLS** (customer own, staff own, owner all, business B sees nothing, no direct writes), cancel window and history, **atomic reschedule**, staff with bookings can't be removed, public busy times hide drafts, the exclusion constraint for privileged writers, 10-per-hour limit |
| `12_appointment_management` | Provider side: who may add (anon, customers, other businesses refused), phone bookings reuse clients by phone, overlap and outside-hours rules, anonymous walk-ins, staff limited to their own column and history, every status transition and time rule, final price, undo, early completion freeing the slot, moves with history, reassignment, client isolation and duplicate phones |
| `13_discovery` | `get_busy_intervals_many`: published only (drafts silently left out), ids and times only, 60-business and 3-day caps |
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
| `search-query.test.ts` | "what in where" / "near me" parsing, last-place-word splitting, coordinate parsing |
| `mock-sms-provider.test.ts` | Mock records and logs messages |
| `calendar-layout.test.ts` | Minutes in the business timezone, the visible window, overlap lanes and minimum heights, Monday weeks, 6-week month grids, month arithmetic, the now line |
| `availability.test.ts` | The scheduling engine: grid anchoring, split shifts, closed days, staff ∩ business hours, blocks, appointments with buffers, min notice / max advance, DST (skipped and repeated times), non-UTC zones, "any available" merge and fair order, part-of-day grouping |

## Integration and end-to-end tests
- Both create a **fresh email/password user per run** through the admin API (secret key; the helpers refuse to run against a non-local Supabase) and delete it, with its businesses and files, afterwards.
- `tests/e2e/onboarding.spec.ts`: sign in → create business → 4 setup steps (including validation errors) → photo resized in the browser and uploaded → publish → public page as a signed-out visitor → QR download → unpublish returns 404.
- `tests/integration/businesses.test.ts`: the same use-cases at the service layer, plus cross-tenant attempts and file-type sniffing.
- `tests/integration/search.test.ts`: the marketplace service on seed data as an anonymous visitor: interpretation, widening notice, near-me, unknown places, category/town filters, newest-first.
- `tests/e2e/marketplace.spec.ts`: search from the home page → result → provider page; the "nothing in this town yet" notice; category town filters; **no sideways scrolling at 360 px** on every public page.
- `tests/integration/booking.test.ts`: availability as anon; book, idempotent retry, slot disappears; privacy across customers and businesses; overlap and out-of-hours refused even when the app pre-check is bypassed; engine↔database parity on a touching slot; atomic reschedule and cancel; **concurrency: 20 customers racing for one slot → exactly 1 booking; 20 racing for "any available" with 3 people → exactly 3, on 3 different people; 10 raw RPC calls racing → exactly 1**.
- `tests/e2e/booking.spec.ts`: at 360 px, a signed-out customer picks a service → "any available" → a time, signs in mid-flow and returns to the same choice, fixes a phone validation error, confirms, sees the booking, and cancels it; plus the public availability API and the 401 on booking without a token.
- `tests/integration/manage.test.ts`: phone booking visible in the owner's calendar; overlap, outside-hours and outsider errors; staff see only their own column and no clients; move + history; a walk-in completed with its final price counted on Today; client search by name or phone, notes, isolation; **10 simultaneous walk-ins for one person → exactly 1**.
- `tests/e2e/provider.spec.ts`: signs in with the **phone OTP** (seed test code); 3-tap walk-in; complete; Today shows it; day/week/month calendar never scrolls sideways at 360 px.
- `tests/integration/discovery.test.ts`: "available today" as anon (future, same local day, label), a business with the rest of today blocked drops out, drafts never appear; "Your places" (cancelled visits don't count, last service and person for rebooking, private to the customer).
- `tests/integration/catalog.test.ts`: services (order, hide, archive), hours, time off, booking rules, team members with own hours, a real phone-bound invite accepted by the right user (and refused for another), removal revoking access, admin refusal.

## Performance
`scripts/perf/search_perf.sql` generates 5,000 businesses inside a rolled-back transaction and times 110 searches as `anon` (≈ 5 minutes, mostly seeding). Last run: p50 9.7 ms, p95 39.5 ms, max 41.3 ms. Not in CI (too slow); run it before changing search.

## Known gaps
- Phone OTP sign-in is covered in E2E with the seed test code. The SMS hook path for other numbers is covered by unit tests and a manual check.
- The engine↔SQL parity check is a set of targeted cases, not the randomised fixture run described in architecture §6.
