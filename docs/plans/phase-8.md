# Phase 8 plan: notifications, reminders, SMS/WhatsApp architecture

Approved by the product owner ("go ahead with the notification and work"), within ADR-0006.

**Goal:** people hear about what matters (booked, confirmed, reminder, moved, cancelled; new bookings for the business) on the right channel, reliably, without any real vendor until one is chosen.

## Scope
1. **Outbox** (`notifications`): written by a trigger in the same transaction as the booking change, deduplicated by `dedupe_key`.
2. **Events**
   | Event | Customer | Business |
   |---|---|---|
   | Online booking (confirmed / waiting) | "You're booked" / "Request sent" | "New booking" / "Needs your OK" (in-app + optional SMS to the business phone) |
   | Business confirms | "Confirmed" + reminders | — |
   | Phone booking by the business | "You're booked" (SMS to the number given) + reminders | — |
   | Reminders | 24 h and 2 h before (only if still in the future) | "Starting in 30 min" to the person doing it (in-app) |
   | Moved (by either side) | "Moved to …" + new reminders | "Customer moved their booking" |
   | Cancelled | by business → customer told | by customer → business told |
   | Completed | "How was it?" in-app 2 h later | — |
   Walk-ins get nothing. Reminders and prompts are cancelled when the booking changes.
3. **Channels:** in-app for every account; one text per event: SMS (default) or WhatsApp (if chosen) or none; email for booked/moved/cancelled when the customer has an email and allows it. Guests and phone bookings: SMS to the number on the booking.
4. **Dispatcher:** `POST /api/internal/jobs/dispatch` (`Authorization: Bearer CRON_SECRET`) claims due rows (`FOR UPDATE SKIP LOCKED`), renders templates, sends through `SmsProvider` / `WhatsAppProvider` / `EmailProvider`, retries 1 → 5 → 15 → 60 min, then `failed`. Hosted: `pg_cron` + `pg_net` every minute (documented, per environment). Local: `node scripts/dev/dispatch-loop.mjs`.
5. **Providers:** `MockSmsProvider` (exists), `MockWhatsAppProvider`, `MockEmailProvider`; env-gated and refused in production. No vendor APIs invented (CLAUDE.md).
6. **Templates:** typed, one file; SMS kept GSM-7 (no ₵, curly quotes or dashes → "GHS 80") and ≤ 160 characters.
7. **UI:** bell with unread dot (Explore, provider header), `/notifications` inbox, Account → "Messages" (SMS / WhatsApp / off, email), provider Settings → "Text my business phone about new bookings".
8. **API v1:** `GET /me/notifications`, `POST /me/notifications/read`, `GET|PUT /me/notification-preferences`.
9. **Tests:** pgTAP `16_notifications`, unit (templates, GSM-7), integration (dispatch end to end with mocks), E2E (book → bell → inbox), docs.

## Key decisions (ADR-0013)
- One text channel per event (never SMS *and* WhatsApp), SMS by default: works on every phone, no app needed.
- Business SMS alerts are on by default and can be turned off.
- Admins can read the outbox (audit/debug); nobody else sees another person's messages.
