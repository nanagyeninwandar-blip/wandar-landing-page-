# Handoff: Wandar Platform Features Page

## Overview
A marketing page presenting Wandar's four platform capabilities — **Social Demand**, **Sales Agent**, **Sales Workspace**, **Safari AI** — to boutique safari operators. Structure follows the Notion "features" pattern: for each capability, a story column paired with an abstract product mock, then a 1×3 "How it supports the sale" grid and a 1×4 "How it works" step row. Closes with a centered CTA and a dark footer.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (React, Next.js, Vue, etc.) using its established patterns, component library, and styling approach. If no environment exists yet, choose the most appropriate framework and implement there.

`Platform Features.dc.html` uses an internal prototyping runtime (inline styles, `{{ }}` template holes, `<sc-if>`). Read it for structure, copy, and exact values — do not port the runtime.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and hover states are final and should be matched. The one deliberate exception: the four product mocks are **abstract illustrations**, not real UX. They use grey skeleton bars (`--neutral-150/200/300`) for most text with only a few real labels. Keep them abstract; do not build them out into real product screens.

## Screens / Views

Single scrolling page, max content width **1280px**, side gutters `clamp(20px, 5vw, 48px)`.

### 1. Hero
- Eyebrow: "Your safari sales platform" — 12px / 700 / `0.08em` uppercase / `--safari-primary`.
- H1: "Everything around a stronger safari sales conversation, connected." — Archivo Black, `clamp(38px, 5.4vw, 68px)`, line-height 1.05, tracking `-0.03em`, max-width 20ch.
- Sub: `clamp(17px, 1.5vw, 20px)`, line-height 1.6, `--fg-2`, max-width 62ch.
- Padding: `clamp(56px,8vw,112px)` top, `clamp(40px,6vw,72px)` bottom.

### 2. Overview cards (hidden by default)
Four-up `auto-fit minmax(300px,1fr)` grid of anchor cards linking to each section (`#social-demand`, `#sales-agent`, `#sales-workspace`, `#safari-ai`). 28px padding, 20px radius, 1px `--border-1`, hover → `--shadow-md`. Each has a 34px circular icon chip in that feature's color. Gated behind the `showOverview` flag, currently `false`.

### 3–6. Feature sections (one per capability)
Section background alternates `--bg-2` / `--bg-1`, 1px `--border-1` top rule, padding `clamp(56px,7vw,96px)` vertical, internal stack gap `clamp(40px,5vw,64px)`.

**Feature row** — `grid-template-columns: repeat(auto-fit, minmax(520px, 1fr))`, gap `clamp(28px,4vw,56px)`, `align-items: stretch`. Mock and copy alternate sides via `order` (Social Demand and Sales Workspace: copy left; Sales Agent and Safari AI: mock left).

Copy column: pill badge (7px/16px, `9999px`, feature tint bg + feature color, 12px/700 uppercase `0.08em`) → H2 Archivo Black `clamp(30px,3.4vw,44px)` / 1.1 / `-0.03em` → paragraph 17px / 1.65 / `--fg-2` / max-width 52ch.

Mock column: tinted rounded stage, **28px radius, `min-height: 500px`** (all four mocks are the same size). Stage tints: `--safari-primary-light`, `--safari-secondary-light`, `--safari-nature-light`, `--safari-gold-light`.

| Feature | Mock |
|---|---|
| Social Demand | Two-pane app shell (sidebar `0.42fr` + main `1fr`) inside a white 18px-radius card with `--shadow-md`. Sidebar: "Social Demand" title, nav (Insights / Lead Feed / Sources), "SIGNALS" skeleton list. Main: "Insights" title, "Last 30 days · 214 conversations", Kenya pill, three signal rows with progress bars (Green season value 42 / 82%, Kenya vs Tanzania 31 / 61%, Travelling with children 17 / 36%; first row highlighted on `--safari-primary-light`), and an "Evidence" footer with two skeleton conversation rows. |
| Sales Agent | Chat thread: inbound white bubbles (`16px 16px 16px 4px`), outbound `--safari-primary` white-text bubble (`16px 16px 4px 16px`), then a "Traveler brief" card (Timing / Party / Priority / Budget) with a handoff row. |
| Sales Workspace | "Opportunities" list card (3 rows: avatar circle, two skeleton bars, status pill — Reply due / Specialist / Quote sent) plus a "Customer brief" card with Trip / Open question / Last contact and a clay-tinted "Next action" strip. |
| Safari AI | Two-pane chat shell. Sidebar: Chats 6, New chat / Search chat / Library, "RECENT CHATS" skeletons with one active item. Main: "Safari AI" title (`white-space: nowrap`), GT avatar, teal-tinted question bubble, answer with 34 headline figure, grouped numbered results, and a pill composer "Ask your data anything" with a teal circular send button. |

**How it supports the sale** — label 12px/700 uppercase `--fg-3`, then a 1×3 grid built as `auto-fit minmax(250px,1fr)` with `gap: 1px` over a `--border-1` background (hairline dividers), 1px border, 20px radius, `overflow: hidden`. Each cell: `--bg-1`, padding `clamp(20px,2.4vw,32px)`, 22px Lucide-style icon (2px stroke, `--fg-1`) left of a title (19px/700) + body (15px/1.6/`--fg-2`).

**How it works** — label, then a fixed `repeat(4, minmax(0,1fr))` row (always one line), gap `clamp(16px,2vw,28px)`. Each step: 2px top border (`--safari-*` on step 01, `--border-2` after), Archivo Black 15px step number in the feature color, 17px/700 title, 15px/1.6 body.

### 7. Final CTA
Centered, `--bg-2`, padding `clamp(64px,8vw,112px)`, max-width 1000px. Teal eyebrow "THE FUTURE OF SAFARI SALES IS PERSONAL" (13px/700/`0.09em`), H2 Archivo Black `clamp(34px,5vw,64px)` / 1.05 / `-0.03em` / max-width 18ch / `text-wrap: balance`: "Grow your safari business without making the sales experience less personal." Buttons (8px radius, 13px/24px padding): primary `--safari-clay` white text → hover `--safari-clay-hover`; secondary white with 1px `--fg-1` border → hover inverts to `--fg-1` bg / white text.

### 8. Footer
`--neutral-900`, padding `clamp(48px,6vw,80px)` top / 28px bottom.
- Top row: `logo-banner-dark.png` at 34px height, 1px vertical rule at 18% white, two-line uppercase label "SALES PLATFORM / FOR SAFARI OPERATORS". Right: "Stay Updated" (Archivo Black 24px), body at 62% white, and a pill email field (1px 18% white border, 480px max) with a 38px `--safari-clay` circular arrow button.
- Link grid: `auto-fit minmax(180px,1fr)` — Platform (the four anchors), Why Wandar, For operators, Connect with us (four 34px circular social buttons at 8% white, hover 16%). Column headings 11px/700/`0.09em` in `--safari-clay`; links 15px at 72% white → hover `#fff`.
- Bottom bar: © 2026 Wandar; Privacy Policy / Terms of Service / AI Transparency Statement.

## Interactions & Behavior
- Overview cards and footer platform links are in-page anchors to the four section ids.
- Hovers only, no scale: cards raise to `--shadow-md`; buttons shift one step darker or invert; footer links brighten to white. Transitions 160–200ms, `cubic-bezier(0.22, 1, 0.36, 1)`.
- No scroll animation, no parallax, no loading or error states — this is a static marketing page.
- Responsive: everything is fluid. Feature rows stack below ~1120px (the 520px minmax); "How it works" stays 4-across by design and should be reviewed for a mobile breakpoint (recommend 2×2 under 720px).

## State Management
Three page-level flags only, no data fetching:

| Prop | Type | Default | Effect |
|---|---|---|---|
| `showOverview` | boolean | `false` | Shows the four overview cards under the hero |
| `showSpecNotes` | boolean | `false` | Shows an internal one-line spec note at the end of each feature section |
| `ctaLabel` | string | `"Build with us"` | Primary CTA button label |

## Design Tokens
Full token set in `design-tokens.css` (the bound Wandar design system). Values used here:

**Color** — Safari Teal `#1a7373` (primary, CTAs, links) · Safari Clay `#c45911` (secondary accent, footer headings, CTA button) · Safari Nature `#2d5016` · Safari Gold `#b8860b` · Safari Rating `#d97706` (stars only). Each has a `-light`, `-hover`, and `-press` variant. Surfaces: `--bg-1` `#fff`, `--bg-2` `#fafafa`, `--neutral-900` for the footer. Text: `--fg-1` through `--fg-4`. Borders: `--border-1` `#e5e5e5`, `--border-2`.

**Type** — Archivo Black for display (H1/H2/H3, step numbers, big figures; tracking −0.02 to −0.03em, line-height 0.95–1.1). Plus Jakarta Sans for everything else (body 15–17px, line-height 1.5–1.65). No serif, no mono.

**Radii** — 8px CTA buttons · 12px small cards and inputs · 18px mock shells · 20px grid panels · 28px mock stages · `9999px` pills and badges.

**Shadow** — `--shadow-sm` / `--shadow-md` only; soft warm rgba of `#1a1a1a`. Hairline border **or** shadow, never both.

**Motion** — 120–320ms, `--ease-out` = `cubic-bezier(0.22, 1, 0.36, 1)`.

**Layout** — 1280px max width, `clamp(20px,5vw,48px)` gutters, 24px card-grid gap, `clamp(56px,7vw,96px)` section rhythm.

## Assets
- `assets/logo-banner-dark.png` — Wandar horizontal wordmark, white on dark, from the Wandar design system. Use the codebase's existing brand asset if one is already present.
- All icons are inline SVG in Lucide style (2px stroke, round caps/joins). Replace with the codebase's Lucide dependency rather than pasting the inline paths.
- No photography. The CTA has no image by design.

## Files
- `Platform Features.dc.html` — the full design (structure, copy, all inline style values)
- `design-tokens.css` — Wandar design system tokens and semantic type styles
- `assets/logo-banner-dark.png` — footer logo (copy from the project root `assets/` folder)
