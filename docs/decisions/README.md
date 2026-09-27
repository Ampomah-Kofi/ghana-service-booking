# Architecture Decision Records

Format: Context · Decision · Alternatives · Consequences. Status is one of Proposed / Accepted / Superseded.
Changing an accepted decision means writing a new ADR (see CLAUDE.md §Architecture changes).

| # | Title | Status |
|---|---|---|
| [0001](0001-stack.md) | Stack, hosting and data access | Proposed (Phase 0) |
| [0002](0002-tenancy-rls.md) | Multi-tenancy via shared schema + RLS | Proposed |
| [0003](0003-double-booking.md) | Double-booking prevention with an exclusion constraint | Proposed |
| [0004](0004-auth.md) | Phone-OTP-first authentication on Supabase Auth | Proposed |
| [0005](0005-payments-abstraction.md) | Provider-agnostic payments | Proposed |
| [0006](0006-notifications-abstraction.md) | Notification outbox + channel providers | Proposed |
| [0007](0007-search.md) | Search on Postgres (FTS + trigram + PostGIS) | Proposed |
| [0008](0008-design-language.md) | Apple-inspired design language | Proposed |

All become **Accepted** when Phase 0 is approved.
