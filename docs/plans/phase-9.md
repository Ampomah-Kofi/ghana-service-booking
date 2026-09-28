# Phase 9 plan: payments, deposits, Mobile Money

Approved 28 Sep ("approve"). Builds on ADR-0005; decisions recorded in ADR-0017. Additions from the product owner during the phase: pay in the app **and** face to face; checkout choices Mobile Money, card, bank transfer or just book (Apple Pay only if the provider supports it); owners enter their payout details so the money goes to them.

**Goal:** a customer can pay a deposit (or the full price) with Mobile Money or a card when a business asks for it, the slot is held while they pay, the booking confirms itself when the money arrives, and the business can record cash, all fully testable with a mock before any real provider is connected.

## Scope

1. **Payments ledger** (`payments`, `payment_events`), per ADR-0005:
   - `payments`: one row per attempt. Kind `deposit | balance | full`; method `mobile_money | card | cash`; `status pending | paid | failed | refunded`; amount in pesewas + currency; a unique `idempotency_key`; the provider's reference.
   - `payment_events`: webhook inbox, unique on `(provider, provider_event_id)`, so a duplicate delivery changes nothing.
   - RLS: customers see their own payments; owners and managers see their business's; staff don't see amounts; admins read all. Nobody writes directly; only functions do.
   - `appointments.payment_status` is derived from its payments (nothing due / pending / partially paid / paid / refunded / failed).
2. **Deposit flow (online booking):**
   service has a deposit → booking is created `pending` with a **hold** of `pending_hold_minutes` (default 15; the column exists) → customer chooses **Mobile Money** (network + number) or **card** → charge → paid → the booking **confirms itself**, and "You're booked" plus "payment received" go out through the Phase 8 outbox.
   Not paid in time → the hold expires, the booking is cancelled and the slot is freed (job, plus lazily at the next booking for that person).
3. **Pay in full (optional per business):** a business can let customers pay the whole price online; otherwise they pay at the visit.
4. **At the visit:** completing an appointment shows what's still owed ("GH₵ 50 paid online · GH₵ 30 to collect"). The provider marks **cash** or **Mobile Money received** (`CashProvider`, manual, audited in the status history).
5. **Refunds (policy, not magic):**
   - customer cancels inside the business's cancellation window → deposit refunded automatically (provider refund call);
   - customer cancels late or doesn't show → the business keeps the deposit, as stated on the booking screen before paying;
   - business cancels → always refunded.
6. **Providers:**
   - `MockPaymentProvider` (dev/staging only, refused in production). Its `/dev/mock-pay/[id]` page lets you approve, decline or time out and sends a signed fake webhook.
   - `CashProvider` (manual).
   - **No real Mobile Money or card vendor is called in this phase** (CLAUDE.md: no invented APIs). The adapter for the chosen aggregator is written from its official docs once you pick one and give sandbox keys (see open questions).
7. **Webhook + reconciliation:**
   - `POST /api/webhooks/payments/[provider]` verifies the signature, stores the event first, then applies it in one transaction (`FOR UPDATE`, state machine).
   - A job polls payments still `pending` after 10 min (webhooks get lost) and expires holds. It runs via the existing `CRON_SECRET` job route and the local dispatch loop.
8. **Business settings** (setup step + Settings): "Ask for a deposit" per service (exists), "Let customers pay in full online", and what happens to deposits on late cancel or no-show (keep / refund), in plain words.
9. **UI:**
   - booking step 3 gains a Pay step: amount, what it covers, refund rule, then Mobile Money or card, then a waiting screen ("Approve GH₵ 50 on your phone") with the hold countdown;
   - the ticket shows "Deposit paid GH₵ 50 · GH₵ 30 at the visit";
   - Provider Today and appointment pages show payment badges, and "Mark paid (cash)" on complete;
   - a simple **Payments** list on More (today, this week: received online, collected cash, refunds).
10. **API v1:**
    - `POST /appointments/{id}/payments` (start a payment) and `GET /appointments/{id}/payments`;
    - the webhook is internal and not part of v1;
    - OpenAPI and `docs/api/v1.md`.
11. **Notifications (Phase 8 templates):** payment received (customer), deposit paid (business), refund issued, and "hold about to expire" (in-app).

## Key decisions (ADR-0017 to write)

- **Money goes straight to the business, never through Hyia** (ADR-0005). With an aggregator this means each business connects its own merchant account or subaccount; until then, online payment stays off for real businesses and only the mock works in dev.
- **Holds use the existing double-booking constraint**: a `pending` appointment already blocks the slot, and the hold only adds an expiry. No new locking.
- **Deposits are optional and per service** (already modelled); full online payment is a per-business switch.
- **Refund rules are shown before paying** and follow the business's existing cancellation window.
- **Amounts are integer pesewas + ISO currency**; a payment's currency must equal the booking's.

## Files (planned)

- `supabase/migrations/2026100809*_payments.sql`: tables, RLS, functions `start_payment`, `apply_payment_event`, `record_manual_payment`, `refund_payment`, `expire_holds`, `payment_status` derivation.
- `supabase/tests/database/18_payments.test.sql`: tenant isolation, state machine, idempotent webhooks, holds expire and free the slot, refunds follow policy, concurrency on the same payment.
- `src/server/payments/`: `provider.ts` (interface), `mock/`, `cash.ts`, `service.ts`, `webhooks.ts`, `reconcile.ts`.
- `src/app/api/webhooks/payments/[provider]/route.ts`, `src/app/dev/mock-pay/[id]/page.tsx` (dev only, 404 in production).
- Booking pay step, ticket and provider payment UI, the Payments page, the settings rows.
- `src/server/env.ts` (`PAYMENTS_PROVIDER`, `PAYMENTS_WEBHOOK_SECRET`), `.env.example`, `docs/env.md`.
- Tests:
  - unit: state machine, amounts;
  - integration: deposit booking → mock pay → confirmed; expiry; refund; duplicate webhook;
  - E2E: book with deposit → approve on the mock page → ticket shows paid.
- Docs: ADR-0017, `architecture.md` §8, `data-model.md`, `api/v1.md`, `testing.md`.

## Open questions (don't block starting)

1. **Which aggregator for Mobile Money and cards in Ghana?** Candidates to evaluate from their official docs: Paystack, Hubtel, Flutterwave, ExpressPay. I'd suggest Paystack first (GHS, MTN MoMo / Telecel Cash / AirtelTigo Money, cards, test mode, per-business subaccounts). Nothing is integrated until you choose and share sandbox keys.
2. **Should Hyia ever take a commission?** Not in this phase (money never passes through the platform); it changes licensing, so it would be its own decision.

## Out of scope

Payouts and escrow, commissions, invoices and receipts as PDFs, disputes/chargebacks (Phase 10 admin), subscriptions.
