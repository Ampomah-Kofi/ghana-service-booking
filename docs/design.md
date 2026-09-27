# Design Direction

> Added in Phase 0 at the product owner's request: *"the design should be Apple-like."*
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

## 2. Tokens (initial; tuned in Phase 1)

| Token | Value | Notes |
|---|---|---|
| Font | System stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | Renders SF on Apple devices and Roboto on Android. **Zero font download**, so it's both Apple-like and low-bandwidth |
| Type scale | 34 / 28 / 22 / 17 (body) / 15 / 13 px | Body 17px (iOS default) for legibility; line-height 1.4 |
| Weights | 400, 600 (700 for large titles only) | |
| Radius | 12px cards, 10px inputs/buttons, full for pills/avatars | Continuous-feeling rounded corners |
| Spacing | 4-pt grid; page gutter 16px mobile / 24px tablet+ | Generous whitespace |
| Colour: surfaces | `#FFFFFF`, grouped background `#F5F5F7`; dark: `#000000` / `#1C1C1E` | Light and dark mode from day one (`prefers-color-scheme`) |
| Colour: text | Primary `#1D1D1F`, secondary `#6E6E73`; dark: `#F5F5F7` / `#A1A1A6` | Contrast ≥ 4.5:1 checked |
| Colour: accent | **One brand colour, chosen with the name** (placeholder: deep green `#0A7A5A`, a nod to Ghana without flag clichés) | Used for primary buttons, links and selected slots only |
| Semantic | success, warning, danger in muted tones | Never the only signal; always with text/icon |
| Shadow | `0 1px 2px rgb(0 0 0 / .06), 0 4px 12px rgb(0 0 0 / .06)` | Cards and sheets only |
| Blur | `backdrop-blur` on sticky top bar and bottom tab bar | Behind `@supports`; solid fallback on low-end devices |
| Motion | 200–300 ms, ease-out; sheets spring-like | `prefers-reduced-motion` disables it |
| Icons | Open-source line icon set (e.g. Lucide), 1.5px stroke | Inlined SVG, tree-shaken |

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

## 4. What we will not do
- Ship custom web fonts on public pages (bandwidth).
- Use glassmorphism everywhere. Blur is limited to the two bars.
- Use Apple trademarks, SF Symbols, Apple product imagery, or pixel-copy any Apple or competitor layout.
