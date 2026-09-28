# ADR-0017: Deposits, holds, refunds and payout accounts

**Status:** Proposed (Phase 9; builds on ADR-0005, which stays in force) · **Date:** 2026-09-28

## Context

Phase 9 turns ADR-0005's provider interface into a working flow. The product owner asked for:

- payment both in the app and face to face;
- checkout choices of Mobile Money, card, bank transfer, or "just book" (Apple Pay only if the chosen provider supports it);
- owners giving their own payout details so the money goes to them.

No real aggregator is chosen yet (Paystack is the suggested first candidate). CLAUDE.md forbids invented vendor APIs, so everything runs on `MockPaymentProvider` until sandbox keys exist.

## Decision

1. **"Just book" stays the default.** Online payment is off for every business until the owner switches it on. Services without a deposit never ask for money up front. Cash or Mobile Money handed over at the visit is recorded by any member of the business with `record_manual_payment`. The amount is capped at the price, and staff never see payment amounts (RLS).
2. **Holds reuse the double-booking constraint.** A deposit booking is inserted `pending` with `hold_expires_at` (15 minutes, from `booking_rules.pending_hold_minutes`), so the slot is blocked by the existing exclusion constraint. There is no new locking.
   - An expired hold is cancelled with "Payment not completed in time" and the slot is freed. This happens in the payments job, and also lazily before the same staff's next booking.
   - Notifications wait until the hold is released: payment confirms the booking and sends "You're booked".
3. **The merchant reference is the payment's `idempotency_key`** (`appt:{id}:{kind}:{n}`), set by `start_payment`. The customer's own session can therefore create the attempt and call the provider without the service-role key. Only the webhook route and jobs (`src/server/jobs/**`, `/api/internal/**`) use the privileged client.
4. **Webhooks are applied exactly once.** `apply_payment_event` writes to the `payment_events` inbox, which is unique on `(provider, event_id)`, then locks the payment and applies the state machine. The result is one of: applied, duplicate, unknown_payment, ignored or mismatch.
   - A mismatch in amount or currency is recorded and never applied.
   - Money that arrives after the hold expired is refunded automatically.
   - Webhooks are served at `/api/internal/webhooks/payments/{provider}`. They are internal and not part of `/api/v1`.
5. **Refund policy is in the database.** A trigger on appointment status queues refunds:
   - a cancellation by anyone refunds the paid deposit;
   - a no-show refunds it only if `refund_deposit_on_no_show` is set;
   - a reschedule moves the paid payment to the new booking.

   Owners and managers can also refund by hand, and must give a reason. `claim_refunds` hands refunds to the job with `SKIP LOCKED`.

6. **Payout accounts.** `business_payout_accounts` holds one row per business: Mobile Money (network and number) or bank (bank name and account number).
   - Only the owner and platform admins can read it (RLS), and only the owner can write it, through `set_payout_account`.
   - The UI shows only the last 4 digits.
   - Changing the details resets the account to `unverified` and clears `provider_account_ref`, so the new account must be registered with the provider again (e.g. as a subaccount).
   - The database refuses to switch on `collect_deposits_online` or `allow_full_payment_online` until a payout account exists (BZ409).
7. **Money still never passes through the platform** (ADR-0005). With an aggregator, each business's payout account becomes its own subaccount. The platform holds no funds and takes no commission.
8. **Methods.** `payment_method` covers `mobile_money`, `card`, `bank_transfer` and `cash`. Apple Pay or Google Pay appear only if the chosen provider offers them on its hosted checkout; the app does not integrate them directly.

## Alternatives

| Option                                               | Why not now                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Platform collects, then pays out                     | Licensing, escrow and reconciliation burden (ADR-0005)                           |
| Separate hold table or advisory locks                | The existing exclusion constraint already makes a pending booking block the slot |
| Service-role client in the request path              | Breaks the least-privilege rule; the merchant-reference design avoids it         |
| Store full payout numbers in the browser for editing | Needless exposure; owners re-enter them to change                                |

## Consequences

- The whole flow is testable locally. The mock's `/dev/mock-pay/[reference]` page (404 in production, labelled "development only") posts signed webhooks.
- The real adapter needs contract tests against the vendor sandbox, plus the vendor's subaccount registration, which is what sets `provider_account_ref` and `status = verified`.
- Payout details are sensitive personal data under Act 843. They are covered by account deletion (cascade) and are admin-readable only for support.
