# ADR-0010: Glass for the navigation layer

**Status:** Accepted (product owner: "give it Apple style app design and stuff glassy") · **Date:** 2026-09-28 · **Amends:** ADR-0009 (depth: "No blur")

## Context

ADR-0009 removed blur because it's costly on low-end Android phones. After the app-feel pass, the product owner asked for a glassy, Apple-style look. Apple's current design language puts translucent "glass" on the **navigation and control layer**: tab bars, toolbars, buttons over media, sheets. Content stays solid.

## Decision

- A `.glass` material (translucent fill, `backdrop-filter: blur(24px) saturate(180%)`, a bright top rim and a soft shadow) is used **only** for:
  - the floating capsule tab bars;
  - the desktop header;
  - round buttons and chips over photos and covers;
  - the booking summary bar;
  - the floating "+" menu.
- **Content stays solid:** cards, lists, forms and text. That keeps it readable in sunlight and cheap to render.
- **Guards:**
  - No `backdrop-filter` support: a solid `card` background.
  - `prefers-reduced-transparency`: solid.
  - Glass areas stay small (bars and buttons, never full screens), so the blur cost stays low.
- The tab bars float as capsules above the bottom edge, with content scrolling underneath, as in current iOS.

## Consequences

- Slightly more GPU work while scrolling under the bars; bounded by the small glass area.
- Dark mode has its own glass tint and rim values.
- DESIGN rules otherwise unchanged: one accent colour, the type scale, radii, formats.
