# ADR-0005: Provider-agnostic payments

**Status:** Proposed · **Date:** 2026-09-27

## Context
We need Mobile Money, cards, cash, deposits and full payment (SPEC §13), but have no provider credentials yet. CLAUDE.md forbids inventing vendor APIs. Webhooks can be duplicated, delayed or lost.

## Decision
- `PaymentProvider` interface: `createCharge`, `verifyWebhook`, `fetchStatus`, `refund`. Implementations: **`MockPaymentProvider`** (dev/staging only, env-gated, refuses to start in production) and **`CashProvider`** (manual mark-paid). A real aggregator is chosen in Phase 9 from its official docs.
- `payments` rows per attempt with a unique `idempotency_key`. The `payment_events` inbox is unique on `(provider, provider_event_id)`, so webhook processing is idempotent. Transitions are validated against a state machine under `SELECT … FOR UPDATE`.
- A reconciliation job polls `fetchStatus` for stale `pending` payments.
- Funds go directly to the provider's own merchant account; the platform holds no money in the MVP.

## Alternatives
| Option | Pros | Cons |
|---|---|---|
| Integrate one vendor directly, no interface | Less code now | Lock-in; no way to build/test before credentials |
| Platform-collected funds + payouts (marketplace model) | Commission capture, unified checkout | Regulatory/licensing burden, reconciliation, disputes. Post-MVP |
| Direct MNO APIs (per network) | Lower fees | One integration per network; heavier onboarding. An aggregator is simpler for MVP |

## Consequences
- The deposit flow is fully testable end-to-end with the mock before any vendor exists.
- The real provider adapter will need its own contract tests against the vendor sandbox.
