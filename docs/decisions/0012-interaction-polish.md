# ADR-0012: Interaction polish (iOS patterns on the web)

**Status:** Accepted (product owner approved the "Polish" list: "APPROVE") · **Date:** 2026-09-28 · **Builds on:** ADR-0009, 0010, 0011

## Context
After ADR-0011 the screens looked right but still behaved like web pages. The product owner asked for everything a senior Apple designer would add. Constraints stay the same: low-bandwidth phones, public pages that work before JavaScript, no new libraries, glass only on the navigation layer.

## Decision
Each pattern uses the lightest platform feature that does the job, and degrades to today's behaviour:

| Pattern | How | Without support |
|---|---|---|
| Large title that shrinks into a compact glass bar (`<LargeTitle>`) | CSS scroll-driven animations (`animation-timeline: scroll()`) | Plain large title |
| Card cover grows into the business page cover | React `<ViewTransition name="cover-…" share="morph">` | Normal navigation fade |
| Bottom sheets (`<Sheet>`): service details, cancel booking, cancel appointment | HTML `popover` + `popoverTarget` buttons (no JavaScript) | — (baseline in current browsers) |
| Photo viewer: full screen, swipe, "3 of 8" | `popover` + CSS scroll-snap; a few lines of JS open it at the tapped photo | Opens on the first photo |
| Banners ("Appointment moved") (`<Toast>`) | Small client component, `role="status"` | — |
| Tab bar: tap the current tab to scroll to top; tucks away while scrolling down | Small client hook | Bar stays put |
| Skeleton screens | `loading.tsx` per route, shaped like the screen | — |
| Illustrated empty states (`<EmptyState>`) | Inline SVG, category-cover style | — |
| Pinned section headers | `position: sticky` | — |
| Date step: split Month / Day taps opening a grid under the tap (pattern borrowed from an app the owner liked), plus the day strip | Exclusive `<details name>` and links; centring the strip is a tiny client effect | Not centred |
| Booking ticket with **Add to calendar** | Our own RFC 5545 file from `/bookings/[id]/ics` (owner only); no calendar API | — |
| Native share sheet | Web Share API | Page's share section, or copy link |
| "Next up" with a live countdown | Client component, 20 s tick | Server-rendered value |
| Recent searches and instant suggestions | `localStorage` (this phone only, try/catch) + categories and towns already loaded as reference data | Plain search field |

## Consequences
- **No business page skeleton:** a `loading.tsx` there starts streaming before `notFound()`, so hidden or unknown businesses would answer HTTP 200 instead of 404. Correct status wins.
- Toasts drop their `?flag` from the address after showing, except where the flag carries data another step needs (`?added=` on the calendar).
- `.ics` is the only new route; it re-checks that the booking belongs to the signed-in customer (RLS also applies).
- Recent searches never leave the device.
- No new dependencies. The accessibility audit used a one-off copy of axe-core outside the project (see docs/testing.md).

## Migration impact
None for data or APIs. E2E selectors updated: service rows ("Book Skin fade"), photo buttons ("Open photo 1 of 1"), toast wording without a full stop.
