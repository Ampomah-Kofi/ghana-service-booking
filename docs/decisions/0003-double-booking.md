# ADR-0003: Double-booking prevention with an exclusion constraint

**Status:** Proposed · **Date:** 2026-09-27

## Context
SPEC §10: double bookings must be impossible, including under concurrent requests, enforced in the DB. Appointments have variable durations and buffers. "Any available" must assign one of several staff atomically. Blocked times and appointments must not overlap either.

## Decision
1. `appointments.occupied tstzrange` = `[starts_at − buffer_before, ends_at + buffer_after)`, maintained by trigger.
2. `EXCLUDE USING gist (staff_id WITH =, occupied WITH &&) WHERE (status IN ('pending','confirmed','arrived','completed'))` (needs `btree_gist`).
3. All booking goes through `book_appointment(...)` (SECURITY DEFINER). It takes an **ordered list of candidate staff** and tries each in a sub-transaction, treating `exclusion_violation` as "try the next one". If none succeed it raises `BK409`.
4. Blocked times vs. appointments: both `book_appointment` and `create_blocked_time` take `pg_advisory_xact_lock('staff:'||id)` and check the other table under the lock. Direct inserts into `blocked_times` aren't granted.
5. Deposit holds: `pending` + `hold_expires_at`. Expired holds are released lazily in `book_appointment` and by the every-minute job.

## Alternatives
| Option | Guarantee | Why not primary |
|---|---|---|
| Row lock on staff (`FOR UPDATE`) + check-then-insert | Only if every writer follows the protocol | Convention, not constraint; raw SQL and new code paths can skip it |
| Advisory locks + check | Same | Same; used only where a constraint can't reach (cross-table) |
| SERIALIZABLE isolation | Yes | Retry storms at busy times; every path must retry |
| Pre-generated slot rows with unique constraint | Yes for fixed slots | Breaks with variable durations/buffers; huge row counts |
| Single "reservations" table with appointments *and* blocks | One constraint covers both | Extra table + triggers; **documented upgrade path** if the lock approach causes trouble |

## Consequences
- The database rejects overlaps from any writer, including admin SQL and future mobile endpoints.
- The app must map `BK409` to HTTP 409 and show fresh slots.
- **Testing:** pgTAP (overlap, touching edges, cancelled/no-show don't block, buffers, blocks) + a concurrency test (N parallel connections, same slot, expect exactly `min(N, eligible staff)` successes) run in CI against local Supabase. The Phase 0 smoke run on the draft gave 10 sessions / 2 staff → 2 successes.
