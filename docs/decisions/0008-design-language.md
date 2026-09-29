# ADR-0008: Apple-inspired design language

**Status:** Accepted, amended by [ADR-0009](0009-combined-design-system.md) · **Date:** 2026-09-27

## Context

The product owner asked for an "Apple-like" UI. SPEC §1 requires an original identity (no copied branding or visual design), and CLAUDE.md requires low-bandwidth, accessible, mobile-first UI.

## Decision

Adopt Apple's design _principles_ (clarity, deference, depth, restraint) via our own tokens in [`../design.md`](../design.md):

- system font stack (no web-font download)
- generous whitespace, a single accent colour
- iOS-style grouped lists, bottom sheets and a bottom tab bar
- light/dark mode
- subtle shadows, and blur only on the top and bottom bars

No Apple assets, trademarks, SF Symbols or copied layouts.

## Alternatives

| Option                                            | Pros                                                   | Cons                                                    |
| ------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Material Design (Android-native look)             | Familiar to most Ghanaian users (Android-heavy market) | Not what the product owner asked for; feels utilitarian |
| Component library theme (e.g. shadcn/ui defaults) | Fast                                                   | Generic look; still needs the same tokens               |
| Custom web font brand typography                  | Distinctive                                            | Extra 30–100 KB per page on slow networks               |

## Consequences

- The system font renders as Roboto on Android, the majority platform in Ghana. The look stays clean and Apple-like through spacing, hierarchy and restraint rather than the typeface.
- Blur effects need solid fallbacks on low-end devices.
