---
name: Magicus Design System
description: Colour tokens, typography conventions, and component patterns used throughout the app
type: project
---

**Colour palette (all hardcoded inline, no CSS variables):**
- `#3B4953` — primary dark (text, backgrounds for headers/footer chips)
- `#547863` — brand green (interactive elements, borders, icons)
- `#EBF4DD` — light green (hover backgrounds, borders, wing backgrounds on cards)
- `#F7FAF2` — lightest green tint (canvas background, section backgrounds)
- `#90AB8B` — muted green (secondary text, disabled states, icons)
- `#FFFFFF` — white (panels, card body, modal backgrounds)
- `#F59E0B` — amber (mic recording active, "incomplete" badge dot)
- `#C99461` — muted amber/orange (dashed border on incomplete cards, marketing theme dot)
- `#6B8AB8` — muted blue (operations theme dot)
- `#B5894C` — muted gold (finance theme dot)
- `#C0392B` — red (error state in automate modal only)

**Typography:**
- DM Sans (variable `--font-dm-sans`) — body, UI labels
- DM Serif Display italic (variable `--font-dm-serif`) — headings, card names, wordmark

**Component conventions:**
- All styling is inline CSS with Tailwind utility classes for hover/transition states
- No component library. Pure custom components.
- Border radius: 999px for pills, 24px for cards, 12-16px for modals/panels, 8-10px for chip items
- No focus rings implemented on any interactive elements (major a11y gap)
- Dashed border (`border: '1.5px dashed ...'`) used for: card "incomplete" state overlay, wing dividers on ButterflyCard, AddToolInput, connect-target hover outline on canvas
- Shadow uses `filter: drop-shadow()` not `box-shadow` on ButterflyCard (because of complex shape)
- Buttons have no `type="button"` attribute in most cases (form submission risk)
- `aria-label` present on icon-only buttons; mostly absent on others

**Recurring patterns:**
- Inline edit: click to activate, underline-border focuses, blur/Enter commits (CanvasName, ChainRegion label, detail panel fields)
- Section labels: 10px, 600 weight, uppercase, letter-spacing 1.4, color #547863
- Pill badges: background #3B4953 or #EBF4DD, border-radius 999, fontSize 10-11
