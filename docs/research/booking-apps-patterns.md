# Booking apps: design patterns research (Sep 2026)

> Requested by the product owner after Phase 6 ("research Booksy and other apps and understand their designs").
> SPEC §1 limits competitors to *general workflow patterns* and forbids copying branding, text, code or visual design. This note records **patterns only**, from public sources: store listings, help centres, reviews and press. No screenshots, assets or wording were taken.
> **Method limits:** the build environment blocks direct access to most of these sites, so findings come from search-engine summaries of those public pages. Treat them as secondary sources; the source list is at the end.

## 1. What the leading apps have in common

| Pattern | Seen in | What it does for users |
|---|---|---|
| **Real-time availability and instant confirmation** | Booksy, Fresha, Treatwell, Square | "Pick a service, view open slots, lock in your spot in seconds." Booking without phone calls is the core promise |
| **"Any staff" auto-assignment** | Square (setting), Fresha, Booksy | Shows every free time across the team and assigns someone automatically |
| **Rebook in one tap from past appointments** | Booksy, StyleSeat, Fresha | Repeat clients are most of the business; "book again" removes all the choosing |
| **Photos over text** | StyleSeat redesign (bigger photos, "images rather than text reviews"), Fresha *Service Portfolio*, Treatwell | Customers judge craft by pictures, so portfolios sit next to the services they show |
| **Search by service, place, date/time; results by availability** | Fresha (treatment, venue, location, date, time, with a map), StyleSeat (lists stylists by availability for last-minute needs) | "Who can do braids today near me?" in one search |
| **Map and directions** | Fresha (results on a map, directions to the venue) | Finding the place; very relevant in Ghana, where landmarks matter |
| **Verified reviews with public replies from the business** | Booksy, Fresha, Treatwell, Vagaro | Trust, and a way for businesses to answer criticism |
| **Self-service cancel/reschedule within policy** | All | Fewer calls; policy shown up front |
| **Automatic reminders** | Booksy (free SMS reminders), Vagaro (email + text) | Fewer no-shows |
| **Deposits, cancellation fees, no-show protection** | Booksy, Fresha | Protects small businesses' time |
| **Pay in app / pay after the appointment / tap-to-pay checkout** | Booksy, Fresha | Checkout folded into the calendar for providers |
| **Favourites** | Vagaro, Booksy | Get back to "my barber" quickly |
| **Deals: off-peak, last-minute, daily deals** | Treatwell, Fresha, Vagaro | Fill empty slots; price-sensitive customers |
| **Share links, QR codes, "Book now" buttons for websites and social** | Fresha, Square, Booksy | The provider's own marketing channel |
| **Provider side: walk-ins, calendar, client list, home-screen widget** | Booksy Biz | Running the chair from a phone |
| **Paid promotion in the marketplace** | Booksy *Boost* (fee on a new client's first visit) | Revenue model; a source of disputes in reviews |

## 2. What users complain about (to avoid)

- **Hard-to-navigate home screen** and "finding your same barber in the app can be a challenge" (Fresha reviews): repeat visits must be one tap away.
- **Disputes over promoted-listing fees** (Booksy Boost reviews): anything paid must be transparent and provable.
- **Referral links that force an app download** (Booksy reviews): our links open straight into the web app, no install needed.
- **Inflexible confirmation messages** (Booksy reviews): providers want to word their own messages (Phase 8).
- **Crashes and outages right before appointments; slow support** (Booksy reviews): reliability and a human support path matter more than features.

## 3. Where Hyia stands

| Pattern | Hyia today |
|---|---|
| Real-time availability, instant confirmation, "any available" | ✅ Phase 5 (and double bookings impossible at the database level) |
| Self-service cancel/reschedule within policy | ✅ Phase 5 |
| Share links, QR code, Book button | ✅ Phases 2–5 |
| Walk-ins, calendar, clients, one-tap statuses | ✅ Phase 6 |
| Photo-first cards and pages, installable app | ✅ App-feel pass (illustrated covers until photos exist) |
| Directions | ✅ link out (no embedded map) |
| **Rebook in one tap** | ✅ "Book again" on past bookings and on Explore |
| **"Your places" (recently booked) on Explore** | ✅ last visit, or "booked" when you haven't been yet |
| **Search/filter by availability ("Available today")** | ✅ live "Today 2:30 pm" on cards, an Explore row, and a search filter |
| Photos per service (portfolio next to the service) | ✅ Phase 7 (tag photos with a service) |
| Favourites, verified reviews with replies | ✅ Phase 7 |
| Reminders, provider-worded messages | ⏳ Phase 8 |
| Deposits, no-show fees, pay after the appointment | ⏳ Phase 9 |
| Map of results | ⏳ later (map tiles cost data and API keys; the distance sort already exists) |
| Off-peak/last-minute deals, loyalty points, paid promotion | ⏳ later (business-model decisions; promotion must be clearly labelled) |

## 4. Recommendations

**Now (small, high value, no new infrastructure):**
1. **"Book again"** on past bookings: same business, service and person, straight to the time step.
2. **"Your places"** row at the top of Explore for signed-in customers: businesses you've booked, one tap to rebook.
3. **"Available today"** chip on Explore and search, computed live for the shown results (the engine already exists).

**Phase 7:** favourites (heart on cards and pages); verified reviews with photos and business replies, shown as the rating on cards; per-service portfolio photos.
**Phase 8:** reminders; providers can edit their message wording; last-minute "free slot" alerts to favourites (opt-in).
**Phase 9:** deposits and no-show protection; pay after the appointment (Mobile Money, cash recorded at checkout).
**Later, needs a decision:** map view; off-peak pricing; loyalty; paid promotion (if ever: clearly labelled, charged only on verifiable new clients).

## Sources
- Booksy for Customers: [App Store](https://apps.apple.com/us/app/booksy-for-customers/id723961236), [Google Play](https://play.google.com/store/apps/details?id=net.booksy.customer&hl=en_US), [feature page](https://biz.booksy.com/en-us/features/customer-app), [How does Booksy work?](https://support.booksy.com/hc/en-us/articles/16460433262098-How-does-Booksy-work)
- Booksy Biz: [App Store](https://apps.apple.com/us/app/booksy-biz-for-businesses/id725335996), [features](https://biz.booksy.com/features), [app updates Dec 2022](https://booksy.com/biz/en-us/blog/booksy-app-updates-december-2022), [Daily Trust review](https://dailytrust.com/booksy-biz-review-pros-cons-and-key-features/)
- Booksy reviews: [App Store reviews](https://apps.apple.com/us/app/booksy-for-customers/id723961236?see-all=reviews&platform=iphone), [Capterra](https://www.capterra.com/p/142741/Booksy/reviews/), [Trustpilot](https://www.trustpilot.com/review/booksy.com)
- Fresha: [App Store](https://apps.apple.com/us/app/fresha-for-customers/id1297230801), [Google Play](https://play.google.com/store/apps/details?id=com.fresha.Fresha&hl=en), [marketplace profile help](https://www.fresha.com/help-center/knowledge-base/online-profile/151-manage-your-marketplace-profile), [how clients book online](https://www.fresha.com/help-center/knowledge-base/online-profile/599-learn-how-clients-book-appointments-online), [Service Portfolio](https://www.fresha.com/blog/fresha-service-portfolio-feature), [Software Advice reviews](https://www.softwareadvice.com/retail/shedul-profile/reviews/), [Sharetribe analysis](https://www.sharetribe.com/how-to-build/website-like-fresha/)
- StyleSeat: [redesign coverage](https://www.retaildive.com/ex/mobilecommercedaily/styleseat-sees-60pc-of-bookings-made-via-mobile-leads-to-a-redesign), [Sharetribe analysis](https://www.sharetribe.com/how-to-build/website-like-styleseat/), [HBS platform case](https://d3.harvard.edu/platform-digit/submission/styleseat-creating-a-two-sided-platform-in-the-fragmented-beauty-industry/)
- Treatwell: [Google Play](https://play.google.com/store/apps/details?id=com.wahanda.marketplace&hl=en_US), [optimising a Treatwell page](http://help.salonized.com/en/articles/7973119-optimising-your-treatwell-page)
- Vagaro: [App Store](https://apps.apple.com/us/app/vagaro/id536110000), [Daily Deals](https://support.vagaro.com/hc/en-us/articles/115003661514-Find-Daily-Deals-on-the-Marketplace-for-Customers-of-a-Vagaro-Business)
- Square Appointments: [set up online booking](https://squareup.com/help/us/en/article/5355-set-up-online-booking-with-square-appointments), [settings ("any staff")](https://squareup.com/help/us/en/article/5351-manage-your-square-appointments-account-settings)
