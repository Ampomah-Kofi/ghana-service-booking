# ADR-0011: iOS-grade refinement of type, depth and controls

**Status:** Accepted (product owner: "the ui is good but make it more apple senior designer ui") · **Date:** 2026-09-28 · **Amends:** ADR-0009 (type, radii, depth, gutter)

## Context
ADR-0009 set flat cards with 1 px borders, a 28/20/17/16/14/12 type scale, 16 px card radius and 16 px gutters. The product owner asked for a more refined, Apple-like finish. On iOS, grouped content has no outlines: white cards sit on a slightly deeper background, list separators are inset from the leading edge, buttons are capsules, and secondary actions are soft grey fills.

## Decision
| Area | Before (ADR-0009) | Now |
|---|---|---|
| Type | 28 / 20 / 17 / 16 / 14 / 12 | 34 / 22 / 17 / 17 / 15 / 12, with tight negative tracking on display, title and heading (in the tokens, not per screen) |
| Surfaces | `surface` #FAF8F4, cards outlined | `surface` #F3F1EC (dark #0B0D0B), cards **without outlines**, separated by `.lift` (a 2-layer, very soft shadow; in dark mode a 6 % hairline rim instead) |
| Lists | full-width `divide-y` | `.ios-list`: separators inset 16 px from the left |
| Radii | card 16 | card 20 |
| Buttons | 10 px radius; secondary outlined | capsules (`rounded-full`); secondary `bg-fill`, danger a 10 % red tint; no outlines |
| Time chips | outlined, green text | grey capsules, ink text, green on hover/press |
| Search | white pill with shadow and a Search button | grey capsule field; the keyboard's Search key submits (the button stays for screen readers and appears on keyboard focus) |
| Gutter | 16 px | 20 px on phones |
| Explore header | greeting + question | date eyebrow, large "Explore" title, account circle |
| Business page | name + chips | App Store-style row (logo, name, capsule **Book**) and a facts strip (reviews · open status · services) |

Unchanged: colours other than `surface`/`border`/dark `card`, the system font, glass only on the navigation layer (ADR-0010), status labels, formats, budgets.

## Consequences
- Inputs keep their 1 px border (a form field must be findable), as do dashed drop zones and the calendar grid.
- `.lift` is only a shadow, so it costs nothing on low-end phones; no blur is added to content.
- The date on Explore uses the country's `default_timezone` (reference data), not a hard-coded zone.

## Migration impact
Class-level only (no data or API change). E2E now submits search with Enter instead of clicking the visible button.
