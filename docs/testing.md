# Testing

| Command | What it runs | Needs |
|---|---|---|
| `pnpm test` | Vitest unit tests (`tests/unit/**`) | nothing |
| `pnpm test:db` | pgTAP tests (`supabase/tests/database/*.test.sql`) via `supabase test db` | local Supabase running (`pnpm db:start`) |
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
| `mock-sms-provider.test.ts` | Mock records and logs messages |

## Manual / browser checks
Playwright E2E arrives in Phase 5 (booking). Until then, critical flows are checked by hand with the checklist in each phase summary. The Phase 1 run used headless Chromium: sign-in → wrong code → right code → account → sign-out, in light and dark mode.

## Known gaps
- No integration tests yet for `src/server` services against a live stack (Phase 2 adds them with the first multi-step service).
- Concurrency tests arrive with booking (Phase 5).
