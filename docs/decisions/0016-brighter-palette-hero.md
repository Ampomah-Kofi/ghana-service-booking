# ADR-0016: Brighter palette, gold accent and a brand hero

**Status:** Accepted (product owner, 28 Sep: "work on the colours and make the UI attractive") · **Date:** 2026-09-28 · **Amends:** ADR-0009 / ADR-0011 (colour tokens)

## Context
After ADR-0014 the screens were calm and clear but read as flat: one green on a beige page, with little that says "this is a lively marketplace for Ghanaian professionals". The owner asked for more attractive colour.

## Decision
- **Primary** moves from `#0F6B4F` to a brighter emerald `#0A7350` (white text 5.9:1; on the page 5.3:1). Hover `#085F42`, soft `#DDF3E9`. Dark mode unchanged.
- **Gold accent** `#F4B400` (dark: `#F5C542`) for highlights only: "New" badges and the professional banner icon. Always a background behind dark text (9:1); gold text on light uses `accent-ink` `#8A5A00`.
- **Brand hero**: Explore opens on a deep emerald gradient with a warm gold glow, white title and a white search field; the "Are you a professional?" banner uses the same treatment. Nowhere else, so it stays special.
- **Sheen**: filled green surfaces get a faint top highlight, so buttons read as lit rather than flat.
- Still tokens only; no new fonts or libraries. Contrast re-checked with `scripts/dev/a11y-check.mjs` (light and dark).

## Consequences
- Revert = the tokens and `.hero` in `globals.css`.
- Gold must stay rare: if everything is gold, nothing is new.
