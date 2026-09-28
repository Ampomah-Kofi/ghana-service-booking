# Phase 10 plan: admin, moderation, reporting, analytics

Started 28 Sep. The product owner said "approved" and "don't wait for my approval again", so this plan records the work rather than gating it.

**Goal:**
- Platform admins can see how the platform is doing, find any business or user, and suspend or restore them, with every action audited.
- Business owners and managers get plain-language insights about their bookings (SPEC §16, §17).

## Scope
1. **Admin overview** (`/admin`): users, businesses by status, bookings (7 and 30 days), completion, cancellation and no-show rates, verification queue, open review reports, recent admin actions.
2. **Businesses** (`/admin/businesses`, `/admin/businesses/[id]`):
   - search by name, slug or town, and filter by status;
   - detail page: owner contact, status, verification, counts, and that business's audit history;
   - **suspend / restore** with a required reason. Suspended businesses disappear from search and their page (existing RLS), and the team cannot re-publish.
3. **Users** (`/admin/users`, `/admin/users/[id]`):
   - search by name, phone or email;
   - detail page: businesses owned, bookings, reviews;
   - **suspend / restore** with a required reason. A suspended person can still sign in and see their bookings, but cannot book, review, report or create a business. This is enforced by database triggers. Admins cannot be suspended here.
4. **Audit log** (`/admin/audit`): every admin action with who, what, why, and before/after, newest first, filterable by action.
5. **Roles:**
   - `super_admin` and `moderator` can suspend and restore;
   - `support` is read-only for businesses and users (it keeps verification and review moderation from earlier phases).
6. **Provider insights** (`/dashboard/[id]/insights`, owners and managers):
   - period: last 7 days, 30 days or 90 days, in the business's timezone;
   - bookings per day (per week for 90 days) as bars;
   - completed, cancelled and no-show counts, with cancellation and no-show rates;
   - revenue as recorded by the business (ADR-0017), plus the value of completed visits;
   - most popular services, most-booked staff (team businesses), and new vs returning customers.
7. **API v1:** `GET /businesses/{slug}/insights?days=7|30|90` for owners and managers (future mobile apps). No admin API.

## Key decisions
- **Admins read through audited, narrow functions, not wider RLS.**
  - `admin_list_businesses`, `admin_get_business`, `admin_list_users`, `admin_get_user` and `admin_platform_stats` are SECURITY DEFINER functions that check the admin role and return only the columns an admin needs.
  - Reads are not audit-logged; every change is (`admin_actions`).
  - This keeps the RLS surface as it is (tenant isolation unchanged).
- **Suspension is enforced in the database.** A BEFORE INSERT trigger on appointments (online bookings by the person), reviews, review reports and businesses refuses a suspended account with BZ403. It does not depend on the UI.
- **Insights come from one SQL function** (`business_insights`), for owners and managers only. It computes in the business's timezone. Money is integer minor units, and revenue is only what the business recorded.
- **No new dependencies.** Bars are plain CSS, with exact numbers as text for screen readers.
- **Disputes:** out of scope. No money moves through the app (ADR-0017), and customer-business problems arrive as review reports. This is noted as a gap.

## Files
- `supabase/migrations/20261010090000_admin_analytics.sql`
- `supabase/tests/database/19_admin_analytics.test.sql`
- `src/server/admin/*`, `src/server/businesses/insights.ts`
- `src/app/admin/*`, `src/app/dashboard/[businessId]/insights/*`
- `src/app/api/v1/businesses/[slug]/insights/route.ts`, plus OpenAPI and `docs/api/v1.md`
- Tests: integration (`admin.test.ts`, `insights.test.ts`) and E2E (`admin.spec.ts`)
- Docs: `architecture.md` (roles), `data-model.md`, `testing.md`
