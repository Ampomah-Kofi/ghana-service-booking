# Product Definition

> Phase 0 output. Source of truth for requirements is [`SPEC.md`](./SPEC.md); this file narrows it to a buildable MVP.
> Working name: **TBD**. The shortlist and recommendation are below.

## 1. One-liner
A marketplace where anyone in Ghana can find an appointment-based professional (barber, braider, nail tech, tutor, cleaner…), see real prices and open times, and book in under a minute. Providers get a free public booking page and a calendar that stops double bookings.

## 2. Who it serves

| Role | Core job to be done | MVP success signal |
|---|---|---|
| Customer | "Find someone good near me who is free when I am, at a price I can see up front." | Books without calling or WhatsApp back-and-forth |
| Solo professional | "Stop losing bookings in DMs; share one link; get paid a deposit so no-shows hurt less." | Shares their link and gets bookings through it |
| Multi-staff business | "One calendar for my team, walk-ins included, no clashes." | Staff calendars run on the platform daily |
| Staff member | "See my day and mark clients arrived/done." | Uses the day view on their phone |
| Platform admin | "Keep the marketplace trustworthy." | Can suspend a bad actor and moderate reviews, fully audited |

## 3. Differentiators (Ghana-first, not Ghana-only)
- **Phone-first identity**: +233 phone and OTP, with WhatsApp and SMS as the main channels. Email is optional.
- **Cash is first-class**: "pay at appointment" is a normal option, not a fallback. Deposits via Mobile Money come after the MVP (Phase 9).
- **Walk-ins are first-class**: they go on the same calendar and follow the same no-overlap rule.
- **Landmark directions**: "opposite the Shell station, second floor" is a proper field, because street addresses are often not enough.
- **Low bandwidth**: server-rendered pages, small images, and no heavy client bundles on public pages.
- **Country-agnostic core**: country, currency, phone region, timezone and categories are all data, so Ghana is just the first row.

## 4. Name shortlist
Criteria: short, easy to say in Twi/Ga/Ewe-speaking Ghana and in English, spellable after hearing it once, no strong collision in bookings, beauty or Ghanaian tech. Conflicts come from a quick web search (Sept 2026) and my own knowledge. **This is not a trademark clearance.** Before committing, search the Ghana Registrar-General's Department, ARIPO and the WIPO Global Brand Database, and check `.com`, `.com.gh`, `.app` and the social handles.

| # | Name | Meaning / feel | Pronunciation | Known conflicts | Verdict |
|---|---|---|---|---|---|
| 1 | **Hyia** | Twi: *to meet*: customer meets provider | "SHEE-ah" (Twi), "HEE-ya" (intl.) | None found in bookings or apps. Sounds close to *Hiya* (US caller-ID app) and *HiA* (a diaspora social app); different category | **Recommended** |
| 2 | **Okwan** | Twi: *the way / path* | "oh-KWAN" | Song titles; *Okwan da ho* (Dutch travel firm doing Ghana trips). No app conflict found | Strong runner-up |
| 3 | **Ntɛm** (written *Ntem*) | Twi: *quickly / early / on time* | "n-TEM" | Ntem is also a river in Cameroon/Gabon (geographic, harmless). No app conflict found | Good; the ɛ/e spelling may split search |
| 4 | **Pɛpɛɛpɛ** (written *Pepeepe*) | Twi/Ghanaian: *exactly, precisely, on point* | "peh-peh-EH-peh" | Popular highlife song titles; no brand found | Memorable locally but hard to spell internationally |
| 5 | **Nkoso** | Twi: *progress / growth*, pitched at providers | "n-KOH-so" | *nKoso*, a US non-profit education crowdfunder in Ghana that is now defunct | Usable; weaker link to booking |

**Checked and rejected** because of live conflicts:

| Name | Conflict |
|---|---|
| Yenko ("let's go") | Yenko Mobility, a live Ghanaian e-mobility **booking** app |
| Ayekoo ("well done") | Ayekoo, a live language-**tutoring** booking app, plus Ayekoo TV in Accra |
| Slotta | Slotta, a beauty/wellness booking app |
| Bookwa | BookWA book-club app |
| Ayoba | MTN's messaging app |
| Tumi / Kasa / Timely / Bookly | Tumi luggage, TP-Link Kasa, Timely salon software, Bookly booking plugin |

**Recommendation: Hyia.** The meaning *is* the product, it is 4 letters, and it reads fine in English even when mispronounced. It also works as a verb in a tagline ("Hyia your barber"). The risk is inconsistent pronunciation abroad. Mitigate with a phonetic hint on the landing page and a domain such as `hyia.app` or `gethyia.com`. **Okwan** is the fallback if Hyia fails clearance.

## 5. MVP scope (end of Phase 10)

| Area | In MVP |
|---|---|
| Accounts | Phone + OTP for everyone. Email/password optional for providers. Guest booking where the business allows it |
| Provider onboarding | Self-service wizard (SPEC §6). Solo path skips staff screens. Preview → publish. Public page `/business/{slug}` with share links and QR code |
| Catalogue | Admin-managed categories; services with price (pesewas), duration and optional deposit; staff with services and weekly hours |
| Scheduling | Business and staff hours, split shifts (breaks), blocked times, days off, buffers, minimum notice, maximum advance window, "any available" |
| Booking | Online booking, provider manual booking, walk-ins, cancel/reschedule within policy, status history. **No double bookings (DB-enforced)** |
| Discovery | Homepage sections, category browse, text + location search, "near me", result cards with next available slot |
| Customer | Upcoming/past appointments, favorites, verified reviews |
| Provider dashboard | Today/upcoming/completed/cancelled/no-show counts, day/week/month calendar, expected revenue |
| Notifications | Booking confirmation, reminder, cancel/reschedule, and new-booking alerts via SMS + in-app. WhatsApp and email behind the same interface (`Mock*` until credentials exist) |
| Payments | Cash at appointment. Deposit/full payment flow on `MockPaymentProvider`, with a real Mobile Money provider plugged in during Phase 9 once credentials and docs exist |
| Admin | Users, businesses, categories, review moderation, suspensions, basic stats. Every action audit-logged |
| Analytics | Bookings over time, revenue, top services/staff, cancellation and no-show rates, new vs returning customers (SQL views, no BI tool) |
| Privacy | Account deletion (anonymises appointment records), business deactivation, consent records for marketing messages |

## 6. Explicitly excluded from the MVP

| Excluded | Why / when |
|---|---|
| Native iOS/Android apps | SPEC §2. `/api/v1` is shaped for them; evaluate after launch |
| Multi-service appointments in one booking (e.g. braids + nails, back to back) | Complicates slot search a lot. v1.1 via `appointment_items` |
| Shared resources (chairs, rooms, equipment) as a scheduling constraint | Staff is the only constrained resource for now |
| Multiple locations per business in the UI | Schema allows it; UI assumes one |
| Home-service travel time / service radius | Model later with travel buffers |
| Recurring appointments, packages, memberships, gift cards | Post-MVP |
| Waitlists | Post-MVP |
| Group classes / multi-attendee slots | Different capacity model |
| Tips, product sales, POS, inventory | Out of scope |
| Payouts / marketplace escrow (platform holds money) | Payments go straight to the provider's account; platform-collected funds bring licensing questions (Bank of Ghana) |
| Google/Apple sign-in | Architecture ready (Supabase providers); switch on after launch |
| Marketing campaigns / bulk SMS to clients | Needs consent tooling and cost controls |
| Two-way calendar sync (Google/Outlook) | Post-MVP; an ICS export link is a cheap first step |
| Dedicated search engine (Meilisearch/Typesense) | Postgres is enough; see ADR-0007 |
| Multi-language UI | English only at launch; strings kept extractable (i18n-ready) |
| Data export self-service | SPEC §22 "future". Admin-run export on request in the meantime |
