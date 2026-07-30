# TradeLynq V2 — Design Law

**Read this before any visual or UI decision.** Fonts, colour, spacing, radius, elevation, and motion are defined here. Do not deviate without explicit approval.

Source of truth: [`../TradeLynq-Docs/v2/02-DESIGN-SYSTEM.md`](../TradeLynq-Docs/v2/02-DESIGN-SYSTEM.md) (architecture, motion, component contract) as amended by [`02A-DESIGN-R2.md`](../TradeLynq-Docs/v2/02A-DESIGN-R2.md) (colour + type values). Where the two disagree on a **value**, R2 wins; on **architecture**, 02 stands.

> **Status: D67 — the V1 front end returns (29 July 2026, Gregg's direct instruction).** V2's backend, routes, and page inventory stand; the presentation layer is V1's. Now LAW — do not "fix" the code back toward earlier directions:
>
> 1. **V1's skin**: warm-white canvas `#F8F7F4`, navy `#1B2637` ink and sidebar, slate borders, **cyan (`#00bdd6`) as the sole interactive accent**, amber `#F59F0A` highlights. Cards stay white with the navy-tinted `--shadow-e1/e2/e3` elevations (the 28 Jul depth lesson survives the palette swap).
> 2. **Satoshi is back** — the single brand face, self-hosted from V1's Fontshare kit via `next/font/local` (zero runtime font requests). Heroes at **900** again. JetBrains Mono keeps every numeral.
> 3. **V1's motion vocabulary is back** (see §5) — the wow factor is a product requirement, not slop.
>
> `app/globals.css` is the value source of truth; this file explains it. Because components consume token names only, palette evolution stays a one-file edit.

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

Values below mirror `app/globals.css` (28 Jul amendment). If they ever disagree, the CSS wins and this file gets corrected — never the reverse.

### Light (`:root`)

```css
--background:        #EEF1F1;  /* canvas, faintly cyan-tinted — cards must float above it */
--card:              #FFFFFF;  /* raised: cards, modals, popovers */
--card-subtle:       #E6EAEA;  /* inset: inputs, alt rows, wells */
--sidebar:           #10161F;  /* app sidebar — the structural navy */

--foreground:        #10161F;  /* headings — near-black navy */
--body:              #3A424E;  /* body text */
--muted:             #6B7480;  /* secondary text, placeholders */
--border:            #E4E6E4;  /* hairlines, dividers */

--accent:            #00BDD6;            /* interactive CYAN — fills, active, tints */
--accent-ink:        hsl(187 100% 27%);  /* accent as text/links (AA on paper) */
--accent-foreground: #052932;            /* dark ink ON a cyan fill */
--accent-soft:       hsl(187 62% 94%);   /* selected/hover cyan wash */

--warning:           #E09410;  /* amber, desaturated */
--success:           #0F9B72;  /* emerald, desaturated */
--destructive:       #DC4B4B;  /* red, desaturated */
--info:              #3E72C4;  /* blue, desaturated */
--whatsapp:          #25D366;  /* recognition signal, outside the status vocabulary */

--brand-cyan / --brand-amber (+ -ink)   /* V1 accents for infographic moments only */
--ring:              #00BDD6;  /* focus ring */
--aurora-1/2/3                 /* the living hero mist — the one atmospheric use */
--shadow-e1/e2/e3              /* bespoke navy-tinted elevation — never Tailwind grey */
```

### Dark (`.dark`)

```css
--background:        #0B0F14;
--card:              #131922;
--card-subtle:       #0F151D;
--sidebar:           #0B0F14;

--foreground:        #E9EAEC;  /* never pure white */
--body:              #B8BEC7;
--muted:             #7D8695;
--border:            #232B37;

--accent:            hsl(187 88% 46%);  /* cyan lifted to carry on the deep field */
--accent-ink:        hsl(187 85% 64%);
--accent-foreground: #04222A;
--accent-soft:       hsl(190 45% 15%);

--warning:           #D18A16;
--success:           #14A882;
--destructive:       #E06767;
--info:              #5589D6;

--ring:              #00A8BF;
```

### Colour usage laws

1. **`--accent` (cyan) is the only interactive colour** — primary buttons, links, active states, selected controls, progress, tints. Navy (`--foreground`/`--sidebar`) is structure and ink, never a button.
2. **`--brand-cyan`/`--brand-amber` are infographic accents** — tickers, flow lines, coloured proof icons. Never surface colours, never body text (use the `-ink` variants for text).
3. **`--warning`** fills exactly two jobs: pending/warning badges, and upgrade-signal CTAs. Never a primary action.
4. **`--success`** marks verified and succeeded. Never decorative, never a CTA.
5. **Violet is retired platform-wide** (D32). Registered Businesses differentiate by **badge, not colour**. There is no `--domain-business` token in V2.
6. **Depth at rest:** cards on the canvas carry `shadow-e1` resting; `e2` on hover/raise; `e3` for overlays. The empty resting state is the first thing every account sees — it gets the premium cues, not just the hover state.
7. **Status mapping is global and fixed** — the same state never changes colour between surfaces:

   | State | Colour |
   |---|---|
   | pending | amber (`--warning`) |
   | active / accepted | accent |
   | completed / verified / paid | emerald (`--success`) |
   | declined / cancelled / overdue | red (`--destructive`) |
   | draft / neutral / converted | muted |

## 3. Typography

**Satoshi** for everything (D67 — self-hosted from V1's Fontshare kit via `next/font/local`, variable 300–900), **JetBrains Mono** 400/500 with `tabular-nums` for every numeral. Zero external font requests at runtime. Display weights are V1's: **900 heroes** (`display-2xl/xl`), **700 titles** (`display-lg/md`), 600 sections (`display-sm`) — strong at large sizes without feeling cold.

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

M1–M16 remain the workhorse catalogue for functional state changes. **D67 reopens the catalogue**: V1's wow vocabulary is first-class again — the ported components (`marquee`, `shine-border`, `animated-list`, `animated-shiny-text`, `word-rotate`, `hyper-text`, `pulsating-button`, `avatar-circles`, `bento-grid`, `confetti`, `progressive-blur`, and `components/ui/magicui/*`: `border-beam`, `number-ticker`, `shimmer-button`, `magic-card`, `particles`, `text-reveal`, `animated-gradient-text`, `animated-section`, `dot-pattern`, `rainbow-button`, `animated-circular-progress-bar`) plus the `animate-*` utility classes and `[data-animate]` scroll entrances in globals.css. Marketing and public surfaces get the wow; workspace surfaces stay purposeful (state-communicating motion first). Everything must still degrade under `prefers-reduced-motion` — the global override in globals.css enforces the floor.

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

**Overturned by D67 (was: "deleted from V1 and never to return"):** the V1 animation set is restored per Gregg's direct instruction — the wow factor is the product's personality, not slop. The discipline that stays: motion on data/workspace surfaces still communicates state; ambient motion belongs on marketing surfaces and hero moments.

**The Field** (the one signature moment, 02A §2A.4) is additive under D34 and lives in exactly two places: the landing hero and mobile app-open. Its guardrails outrank its wow — content never waits, poster-first, fades in only after LCP, static under `prefers-reduced-motion` / data-saver / low battery, self-disables via frame-time watchdog, kill-switch flag without deploy.

## 6. Component contract

The inventory is **closed**: 24 primitives + 12 marketplace patterns. Anything new requires a decision entry in `12-DECISIONS-AND-OPEN-QUESTIONS.md`. Full anatomy per component is in 02 §2.5 — build from that, not from memory.

Shared conventions: CVA for variants · `disabled` = 50% opacity + `cursor-not-allowed`, **never colour-shifted** · all controls ≥ 44×44px touch target (visual size may be smaller with padded hit area) · every primitive keyboard-complete and labelled.

**Every data surface ships loading, empty, and error states.** An `EmptyState` never says "No data" — per-surface copy is written in the surface specs.

## 7. The anti-slop covenant

From `v2/01 §1.3`. In doubt, remove. Specifically banned:

- Emoji in UI (copy or labels)
- Rainbow KPI cards (per-stat coloured backgrounds)
- Generic filler copy ("No data", "Something went wrong", "Click here")
- Stock-photo texture where real content belongs
- More than one primary action per view region

Amended by D67: decorative gradients/glows and ambient motion are **allowed on marketing/public surfaces** through the ported V1 components — that is the wow factor, applied deliberately. Workspace data surfaces keep the restraint.

## 8. The warmth pass (D61, superseded same day by D67)

**Decided:** Gregg answered the audit directly — full V1 front end. Canvas is V1's warm white, display weight is back to 900, and the motion vocabulary returned (§5). `/dev/warmth` is kept as a historical comparison. The two dispositions still in force from the audit: **density** (adopt where content is real, never fake it) and **photo-led colour moments** (extend to category/storefront/portfolio as S113 closes out). The original audit table:

| Delta | V1 | V2 today | Disposition |
|---|---|---|---|
| Canvas temperature | warm white `#F8F7F4` (sunlit) | cool cyan-tinted `#EEF1F1` | **Gregg's call** — `/dev/warmth` renders both |
| Display weight | Satoshi **900** heroes — heavy, confident | Bricolage 500–600 ("finer type" direction) | **Gregg's call** — `/dev/warmth` renders both |
| Information density | Thumbtack-style: counts, chips, prices everywhere | airier, more whitespace | Adopt where content is real: live counts, category chips, price signals on public surfaces. Never fake density. |
| Colour moments | amber highlights, cyan tickers, photo-led galleries | tokens exist (`--brand-*`, aurora) and are used on the landing | Extend to category/storefront/portfolio surfaces as they close out (S113). Photos of real work are the warmest asset we have. |

Rules for the pass: token- and composition-level only (no per-page hacks) · resting/empty states first (§2 law 6) · the anti-slop covenant still applies — warmth is content and craft, not decoration.

## 9. Review checklist

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
