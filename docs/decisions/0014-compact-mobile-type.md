# ADR-0014: Compact phone type scale and denser lists

**Status:** Accepted (product owner, 28 Sep: "the text and stuff, some are too big… ensure that it's very nice and organized and very clear… most of the users will be using mobile phone") · **Date:** 2026-09-28 · **Amends:** ADR-0011 (type row)

## Context

ADR-0011 adopted iOS sizes (34 / 22 / 17 / 17 / 15 / 12 px). iOS points look smaller than CSS pixels on the low- and mid-range Android phones most customers in Ghana use (360–390 px wide, density ~2–3), so on those screens large titles took two lines, service prices squeezed names onto three lines, and search results showed one business per screen. The owner reviewed the screens on a phone and asked for smaller, calmer text.

## Decision

- **Type scale, phone first:** display 28/34, title 20/26, heading 17/22, body 16/24, small 14/20, caption 12/16 (ADR-0009's original sizes). From 640 px up, display and title step up to 32/40 and 22/28; body text never changes size. Still tokens only: no per-screen font sizes.
- **Prices in lists** use `PriceTag`: amount at body size (semibold), "from" as a small caption above it, "Price on request" as quiet wrapping text. Names get the room.
- **Search results and favourites** are rows (88 px picture left, details right) instead of full-width 16:9 cards: 4–5 businesses per screen instead of 1–2. Home rails keep cards, narrower (64% width, 3:2).
- **Business page cover** is 16:10 instead of 4:3 on phones.
- **Tab labels** keep one weight (active = colour + lens), so "Favourites" fits.
- **Appointment rows** show the source as text ("Beard trim · Walk-in") instead of a second badge.

## Consequences

- Screens show more at once; hierarchy comes from weight and spacing rather than size.
- 16 px body is the floor for reading text (no iOS zoom on inputs, readable outdoors).
- Revert = change the tokens in `globals.css` back; nothing else depends on the sizes.

## Found along the way (not a design change)

The page-in animation kept a finished `transform` on the page wrapper, which turned every `position: fixed` element inside it (the provider tab bar, the "+" button) into page-bottom elements that scrolled away. The animation is now opacity-only, and `scripts/dev/overlap-check.mjs` fails on any fixed element trapped by a transformed, filtered or blurred ancestor.
