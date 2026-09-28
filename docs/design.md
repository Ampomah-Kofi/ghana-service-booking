# Design Direction

> Added in Phase 0 at the product owner's request: *"the design should be Apple-like."* Combined in Phase 6 with the owner's DESIGN.md (ADR-0009).
> We take Apple's **principles** (clarity, deference, depth, restraint) and none of its **identity**: no SF Pro font files, no Apple icons or imagery, no copied layouts. SPEC §1 says the product has its own identity.
> Implemented as Tailwind tokens in Phase 1; every screen from Phase 2 onward follows it.

## 1. Principles

| Principle | What it means here | Example |
|---|---|---|
| **Clarity** | One primary action per screen; plain words; big readable type | Booking step shows only "Choose a time" and a single "Continue" |
| **Deference** | Content (photos, prices, times) is the hero; chrome is quiet | White/near-black surfaces, no heavy borders, photos edge-to-edge on provider pages |
| **Depth, sparingly** | Layers communicate hierarchy: sheets slide over content, cards lift slightly | Bottom sheet for time selection on mobile; soft shadow on cards only |
| **Restraint** | Fewer colours, fewer weights, fewer effects | One accent colour; two font weights on most screens |
| **Fast feels premium** | On low bandwidth, speed *is* the polish | Skeletons not spinners; instant tap feedback; no layout shift |

## 2. Tokens (ADR-0009: combined with the owner's DESIGN.md)

| Token | Light | Dark | Use / boundary |
|---|---|---|---|
| `surface` | `#F3F1EC` | `#0B0D0B` | The only page background |
| `card` | `#FFFFFF` | `#1B1F1C` | Cards, sheets, inputs; always on `surface`, never on another card |
| `ink` / `ink-muted` | `#14201B` / `#5B6660` | `#EEF0EC` / `#A6AEA8` | Text; muted text ≥ 14 px, never for prices or actions |
| `border` | `#E4E0D8` | `#2E3430` | Inset list separators, input outlines, calendar grid (not cards) |
| `fill` | ink at 6 % | ink at 8 % | Skeletons, quiet chips, pressed rows |
| `primary` / `primary-hover` | `#0F6B4F` / `#0B5540` | `#4CC596` / `#3DB386` | One filled primary button per screen, links, selected time |
| `primary-soft` | `#E4F2EC` | green at 16 % | Selected-but-secondary (chosen staff, active chip). Never text |
| `danger` · `warning` · `info` · `success` | `#B42318` · `#B54708` · `#1D4ED8` · `#1F7A3A` | lighter equivalents | Status and errors only, always with a label |
| `star` | `#E0A526` | same | Stars only, next to the number |
| `whatsapp` | `#1F7A45` | `#4CC07A` | The WhatsApp button only |

- **Type (ADR-0014, phone first):** system font stack, zero downloads. `display` 28/34 bold (large titles), `title` 20/26, `heading` 17/22, `body` 16/24, `small` 14/20, `caption` 12/16; from 640 px `display` 32/40 and `title` 22/28. Display, title and heading carry their own negative tracking (ADR-0011); don't add `tracking-*` or per-screen font sizes.
- **Prices in lists:** always `PriceTag` (amount at body size, "from" as a caption above, "Price on request" quiet and wrapping).
- **Motion rule:** never animate `transform`/`filter` on a wrapper that contains `position: fixed` elements (it traps them); page transitions are opacity-only.
- **Radii:** `chip` 6 px, `control` 10 px, `card` 20 px. Buttons, chips, search and avatars are full-round capsules.
- **Spacing:** 4 px grid; gutters 20 px on phones.
- **Depth (ADR-0011):** cards have **no outline**; `.lift` (a very soft shadow, a hairline rim in dark mode) separates them from `surface`. Lists use `.ios-list` (separators inset 16 px). `shadow-sheet` for sheets and sticky bars, `shadow-pop` for menus and the floating "+". Blur only on the navigation layer (ADR-0010).
- **Controls:** buttons and inputs 48 px tall; every tap target ≥ 44 px. Primary: filled green capsule. Secondary: grey `fill` capsule. Destructive: red-tinted capsule. No outlined buttons.
- **Motion:** 200–300 ms ease-out; sheets slide up; `prefers-reduced-motion` turns it off.

## 3. Patterns

- **Navigation:** mobile bottom tab bar (Explore · Bookings · Favorites · Account); providers get (Today · Calendar · Clients · More). Large collapsing titles on list screens.
- **Booking flow:** full-screen steps on mobile with a persistent summary pill ("Low cut · GH₵50 · 30 min"). Time slots are a grid of pill buttons, grouped Morning / Afternoon / Evening. Date picker is a horizontal day strip, not a month grid.
- **Lists:** inset grouped lists (iOS Settings style) for settings and onboarding forms.
- **Switches:** every on/off setting is an iOS-style switch (`<input type="checkbox" role="switch">`, styled globally in `globals.css`); plain checkboxes only for picking several items (e.g. which staff do a service).
- **Forms keep what you typed:** after a failed submit the fields are refilled from the server's reply (React 19 resets forms after every action).
- **Sheets over modals:** confirmations and pickers open as bottom sheets on mobile and centred dialogs on desktop.
- **Provider page:** large cover photo, name, rating, "Book" as a sticky bottom button, then services as a clean price list.
- **States:** every screen designs loading (skeleton), empty (friendly line + one action), error (what happened + retry), and validation (inline, under the field).
- **Accessibility:** 44×44 px minimum tap targets, visible focus rings, semantic HTML, labels on every input, WCAG 2.2 AA.

## 3a. Practical rules (added Phase 6)
Picked from the product owner's reference design notes. They sit on top of the look above; colours, fonts and depth are unchanged.

**Formats**
- Time: 12-hour with lowercase am/pm (`9:30 am`), always in the business's timezone. Dates: `Tue, 14 Oct`. Durations: `45 min`, `1 hr 30 min`.
- Money: `GH₵ 150` (no `.00` on whole amounts), starting prices as `From GH₵ 80`, tabular numerals, semibold.
- Phone: `+233 24 123 4567`. Addresses: area first, then landmark (`East Legon · near A&C Mall`), with a Directions link.

**Status**
| Status | Tone | Label |
|---|---|---|
| pending | warning | Pending |
| confirmed | accent | Confirmed |
| arrived | info (blue) | Arrived |
| completed | secondary text | Completed |
| cancelled | secondary text, time struck through | Cancelled |
| no_show | danger | No-show |

Always a text label, never colour alone.

**Buttons and inputs**
- Labels are verb + object ("Book appointment", "Add walk-in"), never "Submit".
- Primary buttons are 48 px tall. While loading they keep their width, show "Booking…" and are disabled (no double submit).
- Inputs are never below 16 px text (no zoom on focus). The label always sits above the field.
- Error messages say how to fix it ("Enter a Ghana number like 024 123 4567").
- Destructive actions confirm with a summary of what will happen, not "Are you sure?".

**Booking flow**
- Slim step indicator ("Step 2 of 4") plus a bottom summary bar (service · time · price) that holds the main button.
- Times are shown in a 3-column grid. Unavailable times are not shown at all.
- An empty day says "No times on Tue. Next available: Thu 10:00 am", with a button to jump there.
- The confirm screen restates: provider, service, staff, date/time, address + landmark, total, deposit and cancellation policy.

**Provider cards**
- No reviews yet shows "New", never "0.0".
- Next available shows as "Today 2:30 pm" (accent) or "Next: Thu".

**Provider calendar**
- Day view by default on phones; week view from tablet width.
- Appointment block: a 4 px left bar in the status tone, then customer name, service and time. Walk-ins get a "Walk-in" badge.
- Blocked time uses a diagonal hatch.
- A floating "+" opens: New appointment / Walk-in / Block time.

**As built (Phase 6)**
- Provider tabs: a fixed bottom bar on phones; a segmented bar at the top from `md`. Staff see Today and Calendar only.
- Day view: a column per person, 72 px per hour, dimmed non-working time, hatched time off, a red now line. Tapping an empty half hour opens "New appointment" prefilled.
- Week view: an agenda list on phones, a 7-day timeline from `md`. Month view: a 6-week grid with up to 3 status dots per day.
- The floating "+" is a `<details>` menu (works without JavaScript), sitting above the bottom bar.
- The appointment page is a card with a status-tone top bar, one primary action, secondary actions, destructive cancel behind a summary, and a history timeline.

**App feel (after Phase 6)**
- **Installable** (`src/app/manifest.ts`): standalone display, brand splash colours, app icon (`scripts/dev/app-icon.svg` → `node scripts/dev/render-icons.mjs`). No service worker yet (offline is a later decision).
- **Shell:** on phones there's no website header. Customers get a bottom tab bar (Explore · Bookings · Favourites · Account), providers their own. Tabs hide on focused screens (business page, booking flow, onboarding). The header returns from `md`.
- **Photo first:** every business has a cover. It's their photo when uploaded, otherwise an illustrated SVG cover per category (`src/components/marketplace/cover.tsx`: zero image bytes; unknown categories get a stable palette and a sparkle).
- **Explore:** greeting, search pill, example chips, category picture tiles, then swipeable rows ("New on …", one row per category with providers), towns, and a card for professionals.
- **Business page:** full-bleed cover with round Back and Share, an info sheet overlapping it (name, category · area, "New", "Open · closes 8:00 pm"), a round action row (Call · WhatsApp · Directions · Share), and a sticky Book bar.
- **Motion:** screens ease in (`src/app/template.tsx`), pressable cards and buttons dip on tap, times slide up, and booking success has a drawn tick. All of it is off with reduced motion.

**iOS refinement (ADR-0011)**
- Explore opens with a date eyebrow, a large "Explore" title and an account circle; search is a grey capsule field submitted by the keyboard.
- The business page header is an App Store-style row (logo, name, capsule **Book**) above a facts strip: reviews · open status · number of services.
- Times are grey capsules; the chosen time turns green.

**Interaction polish (ADR-0012)**
- **Titles:** list screens use `<LargeTitle>`; it shrinks while a compact glass bar fades in (CSS only).
- **Sheets:** details and destructive confirmations open in `<Sheet>` (HTML popover): grab handle, ✕, tap outside or Escape to close; a centred card from `md`.
- **Feedback:** `<Toast>` after moves, cancellations and additions; inline messages stay for form errors and saved settings.
- **Loading and empty:** every main route has a skeleton (`src/components/ui/skeleton.tsx`) except the business page (keeps a real 404); empty screens use `<EmptyState>` (illustration, one sentence, one action).
- **Booking ticket:** date, time and place first, a tear line, then details and round actions (Add to calendar · Directions · Call · WhatsApp · Share).
- **Date step:** the date is split into two taps, **Month** and **Day**. The open one is outlined in green and a short line joins it to a grid right under it (months in a 3-column grid; days as a Monday-first calendar, dates outside the booking window greyed). Borrowed as a *pattern* from an insurance app the owner liked (SPEC §1: patterns only, our own look). Built on exclusive `<details name>`, so no JavaScript. Below it, the day strip: weekday over a day circle (green when chosen, green number for today, dot when there are times), swipeable, with **Today** to jump back.
- **Tabs:** tap the current tab to scroll up; the bar tucks away while scrolling down and returns on the way up; labels truncate rather than overflow at large text sizes.
- **Search:** recent searches (on this phone only) and category/town suggestions under the field.

**Favourites and reviews (Phase 7)**
- **Heart:** a glass round button on every card cover and on the business cover (beside Share); fills red with a pop when saved; signed out it goes to sign-in and comes back. Favourites is the third customer tab.
- **Ratings:** "★ 4.7 (3)" replaces "New" on cards; the facts strip shows "4.7 ★ · 3 reviews". The Reviews section has a big average, bars per star (5 → 1) and the latest three reviews; "See all" opens the full list.
- **Review card:** initial avatar, "Kofi B.", service with person · month and year, stars, text, then "Reply from <business>" in a grey box; Report opens a sheet with reasons.
- **Rate your visit:** completed bookings show **Rate** in Bookings; the ticket has "How was <service>?" with five large stars (real radio buttons; drag across with a finger) and an optional note. Afterwards "Your review" with Edit (14 days) in a sheet.
- **Provider:** Reviews under More, with All / Needs a reply; Reply opens a sheet. Today shows a "2 new reviews" card while any are unanswered.
- **Service photos:** providers tag portfolio photos with a service; up to three thumbnails show in that service's row and a larger strip in its sheet.
- **Account:** Name (editable in a sheet), your reviews, Sign out (grey capsule), and Delete account (red text) opening a sheet that says exactly what happens and asks you to type DELETE.

**Smoothness (after Phase 7)**
- Sheets: iOS curve in and out, frosted, dimmed and blurred page behind, swipe the handle down to close.
- Tabs and segmented controls: the selected lens slides to the new item.
- Pressed rows grey out; no browser tap flash; in-page jumps scroll smoothly; page changes cross-fade briefly.
- Layout rule: nothing may overlap. `scripts/dev/overlap-check.mjs` runs over every main screen at 360 and 390 px, and sheets are checked open.

**"Up next" (provider Today)**
- A Live Activity-style card: deep brand green in both themes with a light glow and rim; "UP NEXT" (a pulsing dot and "NOW" once started) and a frosted countdown pill ("in 25 min", "20 min left", "Running over"); a large start time with the end time beside it; the client's initial, name, service and person; a white progress bar while it's happening; one white capsule action (Confirm / Mark arrived / Complete, whichever is possible now, otherwise Details) beside frosted Call and WhatsApp buttons. Live values tick every 20 s.

**Notifications (Phase 8)**
- A round bell beside the account circle on Explore and in the provider header; a red count (9+ max) pops in when there's something new.
- `/notifications`: a large title with "3 new", an inset list with a tinted round icon (green booking, red cancellation, gold rating), bold title while unread plus a green dot, two lines of text and "25 min ago". Dots clear 1.5 s after you've seen them.
- Account → Messages: SMS / WhatsApp / Don't text me (with a one-line hint each) and an email switch. Provider Settings → Alerts: "Text me about new bookings" switch.

**Glass (ADR-0010)**
- `.glass` / `.glass-strong` (see `globals.css`) are only for the navigation and control layer: the floating capsule tab bars, the desktop header, round buttons and chips over covers, the booking summary bar and the "+" menu. The selected tab is a brighter `glass-lens`.
- Content (cards, lists, forms) stays solid.
- Fallbacks: solid `card` without `backdrop-filter` support, and with `prefers-reduced-transparency`.
- Explore has a soft `aurora` light at the top.

**States copy**
- Empty: one sentence plus one action ("No appointments today. Add a walk-in").
- Error: plain cause plus "Try again".
- Offline: banner "You're offline. Showing saved info."

**Budget**
- ≤ 150 KB gzipped JS on first load for public pages; LCP image ≤ 100 KB.
- Public pages work before JavaScript loads.
- Icons are individual inline SVGs, never whole icon libraries.

## 4. What we will not do
- Ship custom web fonts on public pages (bandwidth).
- Use glass on content: cards, lists and full screens stay solid (ADR-0010).
- Use Apple trademarks, SF Symbols, Apple product imagery, or pixel-copy any Apple or competitor layout.
