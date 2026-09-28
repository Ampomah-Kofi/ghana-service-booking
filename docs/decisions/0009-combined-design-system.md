# ADR-0009: Combined design system (Apple principles + owner's DESIGN.md)

**Status:** Accepted (product owner, Phase 6) · **Date:** 2026-09-27 · **Amends:** ADR-0008

## Context

ADR-0008 set an Apple-inspired direction (clarity, deference, depth, restraint; light and dark mode; soft shadows; blur on bars). In Phase 6 the product owner supplied a detailed DESIGN.md (warm palette, type scale, flat cards, status colours, strict formats, performance budget) and asked to **combine the two** into one very polished UI.

## Decision

One design system, documented in [`../design.md`](../design.md):

| Area                   | Taken from       | Result                                                                                                                                      |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Principles, patterns   | Apple (ADR-0008) | Large titles, inset grouped lists, bottom sheets, iOS switches, bottom tab bars, one primary action per screen                              |
| Palette                | DESIGN.md        | Warm paper `#FAF8F4`, white cards, ink `#14201B`, deep green `#0F6B4F`, soft green, semantic danger/warning/info, WhatsApp green, star gold |
| Dark mode              | Apple            | Kept. Warm dark tokens with the same roles, checked for AA                                                                                  |
| Type                   | DESIGN.md        | System font; 28 / 20 / 17 / 16 / 14 / 12; inputs ≥ 16 px                                                                                    |
| Radii                  | DESIGN.md        | 6 chips · 10 controls · 16 cards                                                                                                            |
| Depth                  | DESIGN.md        | Flat cards with 1 px borders. Shadows only on sheets, sticky bars and the floating "+" button. **No blur** (costly on low-end Android)      |
| Formats, status, flows | DESIGN.md        | `9:30 am`, `Tue, 14 Oct`, `GH₵ 150`, `From GH₵ 80`; status tones + labels; booking-flow and calendar rules                                  |

Token names follow DESIGN.md (`surface`, `card`, `ink`, `ink-muted`, `border`, `primary`, `primary-soft`, …).

## Consequences

- Every component was mechanically moved to the new token names in one commit; no visual rules live outside `globals.css` tokens.
- Removing blur changes the sticky bars to solid `surface` with a hairline border.
- Money strings gain a space (`GH₵ 50`), and times become 12-hour. Tests were updated to match.
