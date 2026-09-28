# ADR-0013: Notification channels, preferences and templates

**Status:** Accepted (Phase 8, approved by the product owner) · **Date:** 2026-09-29 · **Refines:** ADR-0006

## Context
ADR-0006 chose an outbox with a dispatcher and channel providers. Phase 8 had to decide *which* messages go on *which* channel, how people choose, and how texts stay cheap and readable in Ghana. No SMS, WhatsApp or email vendor is chosen yet.

## Decision
1. **In-app for every account, one text per event.** SMS by default (works on every phone, no data needed); WhatsApp instead if the person chose it; or no texts. Never both. Email only for booked / moved / cancelled, when the person has an address and allows it. People without an account (phone bookings by a business) get SMS to the number on the booking. Walk-ins get nothing.
   - Stored in the existing `profiles.notify_sms / notify_whatsapp / notify_email` columns: SMS = (true, false), WhatsApp = (false, true), none = (false, false). The old default (all true) reads as SMS.
2. **Businesses** get in-app alerts (owners, managers and the person doing the job, never the one who made the change) and, by default, an SMS to the business phone for new bookings and customer cancellations (`businesses.notify_new_booking_sms`, switchable in Settings).
3. **Events are produced by a trigger on `appointments`**, so every path (web, API, provider tools, reschedules) is covered, in the same transaction. Reminders are future rows (24 h and 2 h before; a 30-minute heads-up for the provider) and are withdrawn when a booking is cancelled, moved or completed. `dedupe_key` includes the start time, so a moved booking gets fresh reminders.
4. **Templates are code** (`src/lib/notification-templates.ts`), rendered from a payload snapshot. SMS text is **GSM-7 only** ("GH₵" → "GHS", smart quotes and dashes → plain) and **≤ 160 characters**, because one non-GSM character switches the message to UCS-2 (70 characters per part) and doubles or triples the cost. Unit-tested for every template with long names.
5. **Dispatch:** `/api/internal/jobs/dispatch` with `Authorization: Bearer CRON_SECRET`, run every minute by `pg_cron` + `pg_net` on hosted Supabase (set up per environment, see docs/env.md) and by `scripts/dev/dispatch-loop.mjs` locally. Retries back off 1 → 5 → 15 → 60 minutes, then `failed`.
6. **Providers:** `MockSmsProvider`, `MockWhatsAppProvider`, `MockEmailProvider`, selected by env and refused in production. Real vendors are added from their official documentation with their own ADR.

## Consequences
- A vendor outage delays messages but never blocks a booking.
- WhatsApp Business messaging will need approved templates and opt-in from the vendor; the WhatsApp choice is recorded now so the switch is a provider change.
- Platform admins can read the outbox (debugging, disputes); nobody else sees another person's messages.
- Reminder timing has one-minute resolution (the dispatcher's interval).
