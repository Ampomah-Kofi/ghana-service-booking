# ADR-0006: Notification outbox + channel providers

**Status:** Accepted · **Date:** 2026-09-27

## Context
Confirmations, reminders, cancellations, reschedules, payment receipts and provider alerts over SMS, WhatsApp, email and in-app (SPEC §14). Vendors are not chosen. Requests must not block on SMS gateways, and reminders must be scheduled and cancellable.

## Decision
- **Transactional outbox:** the domain change and its `notifications` rows are written in the same DB transaction, with a unique `dedupe_key`.
- **Dispatcher:** `pg_cron` every minute → `/api/internal/jobs/dispatch` (CRON_SECRET) → claims due rows with `FOR UPDATE SKIP LOCKED`, renders typed templates, sends via `NotificationChannelProvider`, retries with backoff (max 4 attempts).
- **Reminders** = future-dated rows (`scheduled_for`), cancelled/replaced on cancel/reschedule.
- Channel providers: `MockSmsProvider`, `MockWhatsAppProvider`, `MockEmailProvider` until real vendors are chosen (Phase 8). In-app = the same table read by the user.

## Alternatives
| Option | Pros | Cons |
|---|---|---|
| Send inline in the request | Simplest | Slow and fragile; lost messages on vendor errors; no scheduling |
| Queue service (SQS, QStash, Inngest) | Scalable, nice retry UIs | Another vendor/account; Postgres handles our volume easily |
| Supabase Edge Functions as workers | Close to DB | Second runtime (Deno) and codebase split |
| Vendor-side scheduling | Less code | Each vendor different; cancellations are hard |

## Consequences
- At-least-once delivery, with `dedupe_key` and provider message IDs making duplicates rare and traceable.
- One-minute resolution on reminders (fine).
- If volume ever needs it, the dispatcher can move to a queue without changing producers.
