# ADR-0017: Booker GH is not a payment platform

**Status:** Proposed, waiting for approval · **Date:** 2026-09-28 · **Would supersede** ADR-0005 (provider-agnostic online payments) and the first Phase 9 build

## Current approach

Phase 9 was built to take money inside the app, following ADR-0005 and SPEC §13:

- a payment attempts ledger, plus a webhook inbox that applies each event exactly once;
- a `MockPaymentProvider` standing in for a real payment company, with a dev-only phone prompt;
- deposit bookings held for 15 minutes while the customer pays online;
- automatic refunds, a reconciliation job, and payout accounts showing where online payments land.

## Problem

The product owner clarified (28 Sep) that **Booker GH must not process payments**. The customer only says how they'll pay. The business collects the money directly: cash handed over, or Mobile Money or a bank transfer to the business's own number. The product owner also chose **no deposits at all** and **removing the online-payment code** rather than keeping it switched off.

Keeping the online build would mean:

- code nobody uses, which still has to be maintained and secured;
- a mock checkout that could be mistaken for a real one;
- a `PAYMENTS_WEBHOOK_SECRET` to manage for nothing.

## Proposed change

1. **No money moves through the app, ever.** No payment company, no card or Mobile Money checkout, no webhooks, no in-app refunds.
2. **Accepted payment methods (per business).** The owner ticks what they accept: cash, Mobile Money, bank transfer, card at the shop. This is shown on their public page and service list, e.g. "Pays: Cash · MoMo".
3. **Customer's choice (per booking).** When booking, the customer picks one of the accepted methods, e.g. "I'll pay with Mobile Money". It is stored on the appointment as `payment_method_choice` and is information only.
4. **Business payment details.** The owner may add a Mobile Money number and name and/or bank details.
   - They are shown to a customer only on that customer's own booking, and only for the method they chose.
   - They are never shown on the public page or in search, and never through the API to anyone else. A database function returns them only to the booking's customer and the business.
   - The ticket shows, for example: "Send to 024 000 0001 (Kwame Asante), MTN MoMo. Reference BK-4821."
5. **The business marks it paid.** "Mark paid" on the appointment records cash, Mobile Money, bank or card, with the amount and an optional note.
   - This keeps the current `payments` table as a simple record of money the business says it received. Refunds are also recorded by the business ("Mark refunded").
   - `appointments.payment_status` stays derived: `null` (nothing recorded), `partially_paid`, `paid`, `refunded`.
   - Staff can mark paid; only owners and managers see amounts (unchanged).
6. **No deposits.** Remove `services.deposit_minor`, `appointments.deposit_minor`, the deposit fields in forms and the API, and the pending-hold logic (`hold_expires_at`). Bookings confirm exactly as they did before Phase 9.
7. **Remove:**
   - **Code:** `PaymentProvider` and the mock, the pay and waiting screens, `/dev/mock-pay`, the webhook and payments-job routes, and `PAYMENTS_PROVIDER` / `PAYMENTS_WEBHOOK_SECRET`.
   - **Database:** `payment_events`, and the functions `start_payment`, `abandon_payment`, `apply_payment_event`, `expire_payment_holds`, `claim_refunds`, `finish_refund` and `stale_pending_payments`.
   - **Automatic behaviour:** the automatic refund trigger, and the online-payment switches in `booking_rules`.

   This is done with a new forward-only migration. Applied migrations are not edited.

8. **Notifications.** Keep one message: an in-app receipt to the customer when the business marks a booking paid. Drop "Refund sent" and all hold-related behaviour.

## Benefits

- It matches how the product owner wants the business to run.
- No payment licensing, provider fees, chargebacks or payment secrets.
- Much less code. The booking flow goes back to its simpler, tested Phase 5 shape.
- It still records who paid what, so the Payments page and Phase 10 analytics (revenue) work from what businesses mark.

## Risks

- **No-shows:** without deposits, businesses carry the risk; the no-show counts in analytics help them see it. Deposits can come back later as a new decision.
- **Accuracy:** "Paid" is only as accurate as what the business records. The page labels it "Recorded by the business".
- **Privacy:** a business's MoMo number is visible to its own booked customers. The owner chooses to add it, and it is covered by account deletion (Act 843).
- **Spec conflict:** SPEC §13 ("online payments", "deposits", "Mobile Money-ready payment architecture") and §5 ("pay deposits where required") need updating by the product owner.

## Migration impact

- One new migration that drops the online-payment objects and the deposit columns, and adds `business_payment_details`, `accepted_payment_methods` and `appointments.payment_method_choice`. It also reshapes `business_payout_accounts` into the payment details that customers see.
  - Existing local and demo payment rows: online attempts are deleted, manual records are kept.
  - Postgres enums can't drop values, so the payment enums are recreated.
- `/api/v1` changes:
  - removed: `deposit` and `hold_expires_at` on appointments, and `POST /appointments/{id}/payments`;
  - added: `payment_method_choice` on bookings, and `GET /appointments/{id}/payment-details`.
  - No mobile clients exist yet, so nothing breaks in the field. The OpenAPI document and `docs/api/v1.md` will be updated.
- Tests: the payments pgTAP, integration and E2E tests are rewritten around the new flow: choose method → see details → business marks paid → tenant isolation of the details.
- Docs: `architecture.md` §8, `data-model.md`, `env.md`, `api/v1.md`, `testing.md`, the Phase 9 plan; ADR-0005 marked superseded.
