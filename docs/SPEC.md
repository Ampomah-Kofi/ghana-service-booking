# Product Specification

Authoritative product spec. Engineering rules live in `/CLAUDE.md`.

## 1. Vision
A multi-business, multi-provider, multi-category appointment marketplace, built for Ghana first and designed to expand to other countries without a rebuild.

Thousands of independent professionals and businesses self-register and operate independently: barbers, hairstylists, braiders/locticians, nail techs, makeup artists, tattoo artists, massage therapists, photographers, tutors, cleaners, consultants, and any other appointment-based professional. Customers use one marketplace to find providers, compare prices, check availability, read reviews, and book.

**Reference products** (for general workflow patterns only): Booksy, Fresha, Square Appointments, StyleSeat, Vagaro, Mindbody, Treatwell, Calendly. Draw on well-known patterns from these categories of product; do not browse, scrape, or copy their branding, text, code, or visual design. The product has its own identity.

## 2. Platform
- Responsive web app now; mobile-first design.
- No native apps yet. Backend and `/api/v1` must be usable by future React Native/Expo or Flutter apps for accounts, businesses, services, staff, appointments, reviews, payments, notifications, favorites, and customer data. Evaluate mobile tech when we get there.

## 3. Ghana-first requirements
+233 phone numbers · GHS (GH₵) · Mobile Money-ready payment architecture · SMS and WhatsApp · cash payment · online payments · low-bandwidth use · walk-ins · solo professionals, small and multi-staff businesses · location-based discovery.
Nothing Ghana-specific may be hard-coded in a way that blocks other countries.

## 4. Roles
1. **Customer** – may browse without an account.
2. **Business owner / independent professional**
3. **Staff member** – scoped to permitted resources of their business.
4. **Platform admin** – controlled, audited privileges.

## 5. Customer experience
Browse categories; search providers, businesses, services, and locations; view business/professional pages, photos/portfolios, services, prices, durations, ratings and reviews, and available times; choose a staff member or "any available professional"; book (as guest where the business allows); pay deposits where required; receive confirmations and reminders; cancel/reschedule per business policy; view upcoming and past appointments; save favorites; leave verified reviews after completed appointments.

**Booking flow:** find provider → select service → select staff or "any available" → select date → select time → enter details → pay deposit if required → confirm → receive confirmation.

## 6. Provider onboarding (self-service)
Create account → verify phone → choose category → business/professional name → description → location → contact info → logo/profile image → portfolio photos → services, prices, durations → staff (skip for solo providers) → business hours → staff schedules → booking rules → payment/deposit preferences → preview → publish.
Solo providers must not be pushed through employee-management screens.

Each provider gets a shareable public page, e.g. `/business/kwame-cuts`, with share links for WhatsApp, Instagram, TikTok, Facebook, SMS, and a QR code.

## 7. Categories
Dynamic, admin-managed (create, edit, reorder, activate/deactivate). Seed examples: Barbers, Hair salons, Braids & locs, Nails, Makeup, Beauty, Spa & massage, Tattoo & piercing, Medical & wellness, Fitness, Photography, Home services, Cleaning, Repairs, Tutoring, Consulting, Event services.

## 8. Provider dashboard and calendar
**Dashboard:** today's/upcoming/completed/cancelled appointments, no-shows, walk-ins, expected revenue, recent customers, notifications.
**Calendar:** day, week, and month views; staff schedules; appointment blocks; breaks; unavailable periods; days off; manual appointments; walk-ins.
**Actions:** create, edit, cancel, reschedule; block time; add walk-in; assign staff; mark arrived / completed / cancelled / no-show. Every status change is recorded in history.

## 9. Services and staff
**Service:** name, category, description, price, currency, duration, optional deposit, eligible staff, active flag.
**Staff:** name, photo, role, services, working schedule, breaks, days off, calendar, availability.

## 10. Scheduling engine (critical)
Availability is computed from: business hours, staff hours, existing appointments, service duration, breaks, blocked periods, days off, booking buffers, minimum notice, and maximum advance window.
Double bookings must be impossible, including under concurrent requests, enforced in the database.

## 11. Search and discovery
Homepage: search, categories, available today, popular, highly rated, recently joined, nearby (with location permission).
Must handle queries like "Barber in East Legon", "Braids in Accra", "Nails near me", "Photographer in Kumasi", "Massage", "Home cleaning".
Result cards: name, image, category, area, starting price, rating, next available slot.

## 12. Location model
Country → region → city/town → neighborhood/area; street address; optional coordinates; optional landmark/directions (important in Ghana). Locations are data (e.g. Accra, Kumasi, Tema, Takoradi, Cape Coast, Tamale are seeds, not code).

## 13. Payments
Provider-agnostic payment interface supporting, eventually: Mobile Money, cards, cash at appointment, deposits, full payment.
Statuses: `pending`, `paid`, `partially_paid`, `failed`, `refunded`.
Until real credentials exist, use a clearly labeled `MockPaymentProvider` behind the same interface.

## 14. Notifications
Vendor-independent interface over channels: SMS, WhatsApp, email, in-app.
Events: booking confirmation, reminder, cancellation, reschedule, payment confirmation, new-booking alert (provider), upcoming-appointment alert (provider).

## 15. Reviews and favorites
Reviews only from customers with a completed appointment: 1–5 stars, text, service booked, date, provider response, reporting, moderation.
Authenticated customers can favorite providers/businesses.

## 16. Analytics (provider)
Bookings (day/week/month), revenue, popular services, most-booked staff, completions, cancellation rate, no-show rate, new vs returning customers.

## 17. Administration
Manage users, businesses, professionals, categories, verification, reviews, reports, payments, disputes, suspensions, platform stats. All admin actions are audit-logged.

## 18. Multi-tenancy (critical)
Business A can never access Business B's private data. Owners see only businesses they own; staff only permitted resources; customers only their own account and appointments; admins get scoped, audited privileges. Enforced server-side and via Postgres RLS.

## 19. Data model (starting point — refine in Phase 0)
users, customer_profiles, businesses, business_members, categories, business_categories, business_locations, services, staff, staff_services, business_hours, staff_availability, blocked_times, appointments, appointment_status_history, payments, reviews, favorites, notifications, business_photos, staff_photos, booking_rules, admin_actions.
Use PKs, FKs, indexes, unique and check constraints, timestamps, soft deletion where appropriate, RLS, and role-based authorization.

## 20. Authentication
Phone + OTP (primary), email/password where appropriate. Architecture ready for Google and Apple sign-in later. No plaintext passwords.

## 21. Security
Server-side authorization, input validation, rate limiting (especially OTP and booking endpoints), secure sessions, CSRF protection where applicable, XSS protection, parameterized queries, secrets management, audit logging, RLS, least privilege.

## 22. Privacy
Data minimization; account deletion; business deactivation; customer data deletion; privacy preferences; consent records where needed; future data export. Design with Ghana's Data Protection Act, 2012 (Act 843) in mind.

## 23. Roadmap
| Phase | Scope |
|---|---|
| 0 | Architecture and planning (docs only, no app code) |
| 1 | Project init, DB foundation, auth, roles, multi-tenancy + RLS |
| 2 | Provider registration and onboarding |
| 3 | Services, categories, staff, business hours, availability config |
| 4 | Public marketplace, provider pages, categories, search |
| 5 | Scheduling engine and booking |
| 6 | Provider dashboard, calendar, walk-ins, appointment management |
| 7 | Customer accounts, history, favorites, reviews |
| 8 | Notifications, reminders, SMS/WhatsApp architecture |
| 9 | Payments, deposits, Mobile Money |
| 10 | Admin, moderation, reporting, analytics |
| 11 | Security review, performance, accessibility, testing, deployment, production readiness |

**MVP principle:** optimized for one developer. Don't overengineer; don't add infrastructure without a stated reason.
