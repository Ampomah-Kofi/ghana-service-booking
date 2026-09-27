# ADR-0002: Multi-tenancy via shared schema + RLS

**Status:** Proposed · **Date:** 2026-09-27

## Context
Thousands of independent businesses. Business A must never see B's data (SPEC §18), enforced both server-side and in Postgres. Staff, managers, customers and admins each have different scopes.

## Decision
- One database and one schema. Every tenant-owned table has **`business_id`**, **RLS enabled**, and explicit policies. No policy = deny.
- Authorization source of truth: **`business_members(business_id, user_id, role)`** with roles `owner | manager | staff`.
- Policies call `SECURITY DEFINER` helpers in a non-exposed `private` schema (`is_business_member`, `can_manage_business`, `is_published_business`, `is_platform_admin`), wrapped in `(select …)` for per-statement caching.
- **Composite FKs** `(business_id, child_id)` make cross-tenant references impossible.
- Multi-table or invariant writes go only through definer functions that check `auth.uid()` explicitly. Column-level grants restrict direct updates.
- **Admins:** no RLS bypass. Read policies where moderation needs them. Writes through audited `admin_*` functions that insert `admin_actions` in the same transaction.
- **Secret (service_role) key:** server-only module guarded by `server-only` + a lint rule. Used only by webhooks, the job dispatcher, the SMS auth hook and seeding.
- Every table ships with pgTAP isolation tests (two tenants × five personas).

## Alternatives
| Option | Pros | Cons |
|---|---|---|
| Schema-per-tenant | Strong separation | Thousands of schemas; migrations × N; cross-tenant search impossible without unions |
| Database-per-tenant | Strongest isolation | Absurd cost and ops for a solo developer |
| App-only checks (no RLS) | Simpler SQL | One forgotten `where business_id = …` leaks data. Violates CLAUDE.md |
| Tenant ID in JWT custom claims | Fast policy checks | Stale on membership change until token refresh; multi-business users need a claim array. Revisit if helper cost shows up in profiling |

## Consequences
- Some policy overhead per query, mitigated by indexes on `business_members(user_id)` and cached helper calls.
- More logic lives in SQL functions, which need pgTAP tests.
- Marketplace-wide queries (search) work naturally over published rows.
