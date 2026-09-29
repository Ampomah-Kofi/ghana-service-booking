# ADR-0015: Verified businesses (admin-checked check mark)

**Status:** Accepted (product owner, 28 Sep: "each business needs a verified check mark"; chose "Admin checks it") · **Date:** 2026-09-28

## Context

Customers book strangers: barbers, electricians, influencers. A check mark next to a name helps them trust a page, but only if it means something. A mark every business gets automatically tells customers nothing and hands scammers the same badge as real shops. SPEC §17 already lists verification as an admin task.

## Decision

- **Admin-granted.** Every published business can apply (owner only). A platform admin (super_admin, moderator or support) checks the owner's details, e.g. calls the business phone and sees a Ghana Card or business registration, then verifies or declines. Unverified businesses still appear and can be booked.
- **In the database.** `businesses.verification_status` (`none` · `pending` · `verified` · `declined`), `verification_requested_at`, `verified_at`. No column grants: owners read but never write them. Two SECURITY DEFINER functions: `request_business_verification` (owner) and `admin_set_business_verification` (admin; a reason is required and every decision goes to `admin_actions` with before/after).
- **The note stays private.** An admin's note to the owner ("we couldn't reach you on …") lives in `business_verification_notes`, readable only by the owner and admins (RLS), because business rows are public.
- **The name is what's verified.** Renaming a verified (or pending) business resets it to `none` (trigger); the owner applies again.
- **Everywhere a customer looks.** Search and favourite cards (`is_verified` from `search_businesses` / `my_favorite_businesses`), the business page (tap for "what this means"), and `/api/v1` (`verified`, `verified_at`).

## Consequences

- Admin work per business; the queue is `/admin/verification` (Phase 10 adds document upload, reminders and SLA tracking).
- No documents are collected or stored yet: the admin checks by phone or in person and writes what they checked in the audit reason. Storing ID documents would need a privacy review (Act 843) first.
- Businesses that change their name lose the check; this is deliberate.
