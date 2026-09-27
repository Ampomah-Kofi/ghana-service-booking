# Architecture Decision Records

Format: Context · Decision · Alternatives · Consequences. Status is one of Proposed / Accepted / Superseded.
Changing an accepted decision means writing a new ADR (see CLAUDE.md §Architecture changes).

| # | Title | Status |
|---|---|---|
| [0001](0001-stack.md) | Stack, hosting and data access | Accepted |
| [0002](0002-tenancy-rls.md) | Multi-tenancy via shared schema + RLS | Accepted |
| [0003](0003-double-booking.md) | Double-booking prevention with an exclusion constraint | Accepted |
| [0004](0004-auth.md) | Phone-OTP-first authentication on Supabase Auth | Accepted |
| [0005](0005-payments-abstraction.md) | Provider-agnostic payments | Accepted |
| [0006](0006-notifications-abstraction.md) | Notification outbox + channel providers | Accepted |
| [0007](0007-search.md) | Search on Postgres (FTS + trigram + PostGIS) | Accepted |
| [0008](0008-design-language.md) | Apple-inspired design language | Accepted, amended by 0009 |
| [0009](0009-combined-design-system.md) | Combined design system (Apple principles + owner DESIGN.md) | Accepted |

Accepted 2026-09-27 with Phase 0 approval.
