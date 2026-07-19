# TradeLynq V2 — Design Law

**Read this before any visual or UI decision.** Fonts, colour, spacing, radius, elevation, and motion are defined here. Do not deviate without explicit approval.

Source of truth: [`../TradeLynq-Docs/v2/02-DESIGN-SYSTEM.md`](../TradeLynq-Docs/v2/02-DESIGN-SYSTEM.md) (architecture, motion, component contract) as amended by [`02A-DESIGN-R2.md`](../TradeLynq-Docs/v2/02A-DESIGN-R2.md) (colour + type values). Where the two disagree on a **value**, R2 wins; on **architecture**, 02 stands.

> **Status: R2-Baseline (Candidate A "Ink & Paper" + type T2).** Locked as the working direction per D56. The final palette/type decision is **28 July 2026** via `/dev/direction` (playbook W1/S058). Because every candidate shares the same token *names*, switching is a token-value edit in one file — never a component change. Build against these values now; do not hand-tune components in anticipation of the decision.

---

## 1. The single most important rule

**Semantic tokens only. Never a literal colour in a component.**

No `bg-white`, no `text-slate-700`, no `#F7F7F5`, no `dark:` overrides for colour. Use `bg-card`, `text-body`, `border-border`. One definition, both themes, zero per-file dark-mode work. CI greps for literal hex and banned utilities in `components/` and fails the build.

| Instead of | Use |
|---|---|
| `bg-white` | `bg-card` |
| `bg-[#F7F7F5]` | `bg-background` |
| `bg-slate-50` (inputs, wells) | `bg-card-subtle` |
| `text-slate-900` | `text-foreground` |
| `text-slate-700` | `text-body` |
| `text-slate-500` | `text-muted` |
| `border-slate-200` | `border-border` |
| accent-as-text | `text-accent-ink` |

## 2. Colour tokens

Each value is tagged by origin: **[R2]** specified in 02A §2A.2 Candidate A · **[02]** carried unchanged from 02 §2.1.1 · **[C]** constructed to fill a gap R2 left open — these are the first things to confirm on 28 July.

### Light (`:root`)

```css
--background:        #F7F7F5;  /* [R2] cool off-white page */
--card:              #FFFFFF;  /* [R2] raised: cards, modals, popovers */
--card-subtle:       #F1F2F0;  /* [R2] inset: inputs, alt rows, wells */
--sidebar:           #10161F;  /* [C]  app sidebar; R2-aligned to --foreground */

--foreground:        #10161F;  /* [R2] headings — near-black navy */
--body:              #3A424E;  /* [R2] body text */
--muted:             #6B7480;  /* [R2] secondary text, placeholders */
--border:            #E4E6E4;  /* [R2] hairlines, dividers */

--accent:            #16202E;  /* [R2] interactive navy — fills, links, active */
--accent-ink:        #16202E;  /* [R2] accent as text on light bg */
--accent-foreground: #F7F7F5;  /* [C]  text/icons ON an accent fill */
--accent-soft:       #EDEFF2;  /* [C]  selected/active tint (navy-tinted, was cyan) */

--warning:           #E09410;  /* [C]  amber, desaturated per R2 "neutral field" */
--success:           #0F9B72;  /* [C]  emerald, desaturated */
--destructive:       #DC4B4B;  /* [C]  red, desaturated */
--info:              #3E72C4;  /* [C]  blue, desaturated */

--ring:              #00BDD6;  /* [R2] cyan — the one cyan retention */
```

### Dark (`.dark`)

```css
--background:        #0B0F14;  /* [R2] */
--card:              #131922;  /* [R2] */
--card-subtle:       #0F151D;  /* [C]  between bg and card */
--sidebar:           #0B0F14;  /* [C]  matches background in dark */

--foreground:        #E9EAEC;  /* [R2] never pure white */
--body:              #B8BEC7;  /* [C] */
--muted:             #7D8695;  /* [C] */
--border:            #232B37;  /* [C] */

--accent:            #D5D9DE;  /* [R2] inverted-ink buttons — light fill */
--accent-ink:        #D5D9DE;  /* [C]  accent as text on dark bg */
--accent-foreground: #0B0F14;  /* [C]  dark text ON the light accent fill */
--accent-soft:       #1C232E;  /* [C] */

--warning:           #D18A16;  /* [C] */
--success:           #14A882;  /* [C] */
--destructive:       #E06767;  /* [C] */
--info:              #5589D6;  /* [C] */

--ring:              #00A8BF;  /* [R2] cyan, desaturated */
```

### Colour usage laws

1. **`--accent` is the only interactive colour** — primary buttons, links, active states, selected controls, progress. In R2 that colour is navy, not cyan.
2. **Cyan is reserved.** It appears in exactly three places: the focus ring (`--ring`), the logo, and the M13 success moment. Nowhere else. Cyan creeping back into fills or links is a review blocker.
3. **`--warning`** fills exactly two jobs: pending/warning badges, and upgrade-signal CTAs. Never a primary action.
4. **`--success`** marks verified and succeeded. Never decorative, never a CTA.
5. **Violet is retired platform-wide** (D32). Registered Businesses differentiate by **badge, not colour**. There is no `--domain-business` token in V2.
6. **Status mapping is global and fixed** — the same state never changes colour between surfaces:

   | State | Colour |
   |---|---|
   | pending | amber (`--warning`) |
   | active / accepted | accent |
   | completed / verified / paid | emerald (`--success`) |
   | declined / cancelled / overdue | red (`--destructive`) |
   | draft / neutral / converted | muted |

## 3. Typography

**Satoshi** for everything (self-hosted via `next/font`), **JetBrains Mono** 400/500 with `tabular-nums` for every numeral. Zero external font requests — no Fontshare, no Google Fonts.

**Every number renders in mono:** prices, ratings, counts, quantities, IDs, table values, stat metrics, dates. This is the brand's precision signature and is not up for revision.

Type direction **T2** (02A §2A.3): display weights drop to **500–600**, sizes rise ~10%, leading tightens. Lightness must read as intent, not weakness.

| Token | Size / weight / leading | Use |
|---|---|---|
| `display-2xl` | clamp(44px, 6.5vw, 66px) / 500 / 1.05 / −0.02em | Landing hero only |
| `display-xl` | 53 / 500 / 1.1 | Section heroes, storefront name |
| `display-lg` | 40 / 500 / 1.15 | Page titles |
| `display-md` | 33 / 600 / 1.2 | Card/modal headings |
| `display-sm` | 26 / 600 / 1.25 | Section headings |
| `text-xl` | 20 / 500 | Leads, sub-headings |
| `text-lg` | 18 / 400–500 | Large body |
| `text-base` | 16 / 400 / 1.6 | Body — minimum for reading content |
| `text-sm` | 14 / 400 | Labels, secondary, table cells |
| `text-xs` | 12 / 400–500 | Captions, badges, fine print — absolute floor |

Rules: exactly one `display-lg`+ element per page · headings left-aligned by default (centred only on the landing hero and empty states) · body max measure 70ch · `text-balance` on headings, `text-pretty` on paragraphs · no ALL-CAPS except `text-xs` badge labels with `tracking-wide`.

> Display sizes above are T2's "+10%" applied to 02 §2.2's baseline — **[C]** arithmetic, confirm on 28 July.

## 4. Space, shape, elevation

- **Grid:** 12 columns / 24px gutter. Content `max-w-6xl`, reading `max-w-4xl`. App shells full-width with a 340px sidebar. Breakpoints **375 / 768 / 1024 / 1440** — 375 is the design origin, not an afterthought.
- **Spacing:** 8px base — 2, 4, 8, 12, 16, 24, 32, 48, 64. Marketplace comfortable (24 between cards); app/admin dense (12–16). Vertical rhythm: 48 between sections (64 marketing), 24 heading→content, 16 between fields.
- **Radius law — nested is always parent − gap, never equal:**

  | Element | Radius |
  |---|---|
  | tag / badge | 4 |
  | button / input | 8 |
  | card / modal | 12 |
  | sheet / large panel | 16 |
  | pill / avatar | full |

- **Elevation — three levels, no others:** `flat` (border only — the default for cards) · `raised` (`shadow-sm` + border — interactive cards on hover, dropdowns) · `overlay` (`shadow-lg` — modals, sheets, popovers). No decorative shadows. **Dark mode expresses elevation by surface colour step, not shadow.**
- **Icons:** lucide-react only. 16px inline / 20px UI / 24px feature; `stroke-width` 2 (1.75 at 24px); colour inherits from text; never inside coloured circles.

## 5. Motion

Physics: micro 50–100ms · short 150–250ms · medium 250–400ms · long 400–700ms. Enter `ease-out`, exit `ease-in`, move `ease-in-out`. **Only `transform` and `opacity` animate.** Named transition properties — `transition: all` is banned and CI-greppable. Everything sits inside `@media (prefers-reduced-motion: no-preference)`; reduced mode swaps movement for opacity-only at ≤100ms.

All constants live in `lib/motion.ts` and are imported — **never re-declared inline.**

The catalogue is **closed at M1–M16**. Nothing else ships.

| # | Name | Trigger | Spec |
|---|---|---|---|
| M1 | Press | button / interactive card `:active` | `scale(0.98)` 80ms ease-out |
| M2 | Hover raise | interactive cards | `translateY(-2px)` + flat→raised, 150ms |
| M3 | Focus ring | `:focus-visible` | 2px `--ring` + 2px offset, 100ms opacity |
| M4 | Fade-slide in | dropdowns, popovers, tooltips | opacity + `translateY(4px)→0` 150ms; exit 100ms |
| M5 | Modal | dialog open/close | backdrop 200ms; panel opacity + `scale(0.97→1)` 250ms; exit 150ms |
| M6 | Sheet | mobile bottom sheet / drawer | `translateY(100%)→0` 300ms; drag-to-dismiss, snaps at 30% |
| M7 | Skeleton | data loading | pulse 0.6↔1 over 1.2s in content's exact geometry — zero shift on swap |
| M8 | Count-up | dashboard stat numbers | mono digits roll 400ms; once per session; reduced-motion instant |
| M9 | Status morph | badge state change in place | old out 100ms, new in 150ms with 1.05→1 |
| M10 | Progress fill | profile strength, credit usage | `scaleX` 400ms ease-in-out |
| M11 | Toast | notification enter/exit | `translateY(8px)`+opacity 200ms; exit 150ms |
| M12 | Accordion | FAQ, filter groups | grid-rows 200ms; chevron rotates 200ms |
| M13 | Check pop | genuine completion only | emerald check stroke-draw 300ms + 1.03 settle — **the platform's one moment of delight** |
| M14 | Tab slide | tab switches | indicator slides 200ms; panels crossfade 150ms |
| M15 | Typeahead reveal | search suggestions | container M4; items stagger 20ms, max 5 |
| M16 | Image settle | portfolio / gallery loads | blur-up 8px + 1.02 → sharp, 300ms; aspect boxes pre-reserved |

**Deleted from V1 and never to return:** `glide-up` ambient drift, `border-beam`, `shimmer-slide`, `gradient-x`, decorative `spin-slow`. Ambient motion contradicts "motion communicates state".

**The Field** (the one signature moment, 02A §2A.4) is additive under D34 and lives in exactly two places: the landing hero and mobile app-open. Its guardrails outrank its wow — content never waits, poster-first, fades in only after LCP, static under `prefers-reduced-motion` / data-saver / low battery, self-disables via frame-time watchdog, kill-switch flag without deploy.

## 6. Component contract

The inventory is **closed**: 24 primitives + 12 marketplace patterns. Anything new requires a decision entry in `12-DECISIONS-AND-OPEN-QUESTIONS.md`. Full anatomy per component is in 02 §2.5 — build from that, not from memory.

Shared conventions: CVA for variants · `disabled` = 50% opacity + `cursor-not-allowed`, **never colour-shifted** · all controls ≥ 44×44px touch target (visual size may be smaller with padded hit area) · every primitive keyboard-complete and labelled.

**Every data surface ships loading, empty, and error states.** An `EmptyState` never says "No data" — per-surface copy is written in the surface specs.

## 7. The anti-slop covenant

From `v2/01 §1.3`. In doubt, remove. Specifically banned:

- Emoji in UI (copy or labels)
- Decorative gradients, glows, and coloured shadows
- Rainbow KPI cards (per-stat coloured backgrounds)
- Ambient/looping motion outside the Field
- Generic filler copy ("No data", "Something went wrong", "Click here")
- Stock-photo texture where real content belongs
- More than one primary action per view region

## 8. Review checklist

- [ ] Zero literal hex or `bg-white`/`text-slate-*`/`border-slate-*` in components
- [ ] Renders correctly in **both** themes (not just light)
- [ ] Renders correctly at **375px** first
- [ ] All numerals in `font-mono` with `tabular-nums`
- [ ] Money via `formatTTD()` — reads `TTD $X,XXX`, never bare, never USD
- [ ] Loading, empty, and error states all present
- [ ] Motion is from M1–M16, imported from `lib/motion.ts`, no `transition: all`
- [ ] Radius follows the hierarchy; nested ≠ equal
- [ ] Focus visible on every interactive element; keyboard path complete
- [ ] Touch targets ≥ 44×44px
- [ ] Copy is Commonwealth English; people are **Customers** and **Professionals**
