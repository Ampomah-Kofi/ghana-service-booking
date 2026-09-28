# CLAUDE.md

Ghana-first, multi-tenant appointment marketplace (working name TBD in Phase 0).
Full product spec: @docs/SPEC.md — it is authoritative. Read it before planning any phase.

## Stack

- Next.js 16: read @AGENTS.md. APIs differ from older versions (e.g. `middleware` is now `src/proxy.ts`); check `node_modules/next/dist/docs/` before writing Next code.
- Next.js (App Router) + React + TypeScript (`strict: true`, no `any`, no `@ts-ignore` without a comment explaining why)
- Tailwind CSS
- Supabase: Postgres, Auth, Storage, RLS. Local dev via Supabase CLI.
- Package manager: pnpm (change only via an ADR)

## How we work

- One phase at a time (see Roadmap in SPEC.md). Never start the next phase without my explicit approval.
- Start every phase in plan mode. Before writing code, present: goal, scope, key decisions, files to create/modify. Wait for approval.
- Work in small, reviewable steps. Commit after each logical unit on a branch named `phase-N-<slug>`. Conventional commit messages.
- Run the checks yourself (`pnpm typecheck`, `pnpm lint`, `pnpm test`, migrations against local Supabase). Never claim something works because it compiles — show the command output.
- If a command needs me (secrets, `supabase login`, Docker, paid accounts), stop and tell me exactly what to run and what success looks like.
- End every phase with: what was built, commands run and results, a manual test checklist, known gaps, and doc updates. Then stop.

## Architecture changes

Never silently change an architectural decision recorded in `docs/decisions/`. To propose one, write a new ADR draft covering: current approach, problem, proposed change, benefits, risks, migration impact — then wait for approval.

## Non-negotiable rules

- **Tenant isolation**: every tenant-owned table has `business_id` and RLS enabled with explicit policies. Authorization is enforced server-side and in the database, never only in the UI. Every new table ships with RLS policies and tests proving Business A cannot read/write Business B's rows.
- **Double booking**: prevented at the database level (constraint or locking), not by application checks alone. Concurrency tests required.
- **Secrets**: the Supabase `service_role` key and any provider secrets are server-only. Never import them into client components or `NEXT_PUBLIC_*` vars.
- **Mocks**: dev/mock payment and notification providers are named `Mock*`, gated by env, and never described as production integrations.
- **No invented APIs**: don't fabricate Mobile Money, SMS, or WhatsApp vendor endpoints. Use the provider interface + mock until real docs/credentials exist.
- Never bypass auth or disable RLS to make something work.

## Conventions

- Money: integer minor units (pesewas) + ISO 4217 `currency` column. Never floats.
- Time: store `timestamptz` in UTC; each business has an IANA `timezone` (default `Africa/Accra`). Availability is computed in the business's timezone.
- Phones: E.164 (`+233…`), validated with a library, not regex alone.
- Country/region/city, categories, currencies: data, not code. No hard-coded Ghana-only enums.
- Validation: shared schemas (e.g. Zod) used by both route handlers and forms.
- Business logic lives in `src/server/` services, not in components or route handlers. Components stay small.
- Public/mobile-facing API lives under `/api/v1` and is documented in `docs/api/`.
- Add dependencies only when justified; mention each new one in the phase summary.
- UI: mobile-first, low-bandwidth friendly (optimized images, minimal JS), with loading, empty, error, and validation states, and accessible markup.

## Docs to keep current

`docs/architecture.md`, `docs/decisions/` (ADRs), `docs/api/`, `docs/env.md`, `docs/testing.md`, `supabase/migrations/`.
