# V1 → V2 Delta

**The comparison log.** V1 (`../Tradelynq`) is preserved and running so testers and the team can compare old against new side by side. This file records, per surface: what changed, what improved, what is intentionally missing (with its D-number or reason), and the open questions worth putting to testers.

Kept current every session a surface changes — it is a first-class deliverable, not a changelog afterthought.

**Legend:** ✨ new · ⬆ improved · 🔄 changed · ⛔ intentionally dropped · ⚠ known gap / not yet built

---

## Status

| Surface | V1 | V2 | State |
|---|---|---|---|
| Foundations (repo, tooling, CI) | — | in progress | Phase 0 |
| Database spine | live | not started | Phase 1 |
| Auth & access layer | live | not started | Phase 2 |
| Design system & primitives | partial | not started | Phase 3 |
| Public marketplace | live | not started | Phase 4 |
| Customer portal | live | not started | Phase 5 |
| Professional workspace | live (split) | not started | Phase 6 |
| Admin console | live | not started | Phase 7 |
| Billing & engines | partial | not started | Phase 8 |
| Mobile apps | live | not started | Phase 9 |

---

## Foundations (Phase 0)

### 🔄 Route groups renamed to match the product vocabulary

| V1 | V2 | Why |
|---|---|---|
| `app/(homeowner)/` | `app/(customer)/` | The canon calls these people **Customers**. V1's `homeowner` is legacy from the trades-only origin and misdescribes the majority of categories (beauty, creative, tech, events). |
| `app/(worker)/` + `app/business/` | `app/(professional)/` | V2 Phase 6 is explicitly *"ONE component set, both roles"*. V1's parallel worker/business stacks are the single largest source of duplicated logic — consolidating them is the whole point of the rebuild. |

Route groups in parentheses do not appear in URLs, so this is developer-facing only — no user-visible URL change, no SEO impact.

> **⚠ Flag:** this diverges from playbook S014's literal folder list (`(homeowner) (worker) business`). No D-number governs route-group naming, so nothing is contradicted, but it is a deliberate divergence and should be ratified as a D-entry. **Ask for testers:** none — invisible to them.

### ⬆ Environment surface is complete and honest

V1's `.env.example` documented 11 variables while the code reads **38** — Stripe, Upstash, Sentry, PostHog, Anthropic, Google Maps, and WhatsApp were all entirely absent from it. A developer following V1's example file would produce a broken deployment and only discover it in production.

V2's `.env.example` is derived from actual `process.env` usage rather than from V1's file, is grouped by subsystem, and marks each variable `[REQUIRED]`, `[REQUIRED-PROD]`, or optional. It also carries the V2-only Stripe items the crossover and Pioneer engines need (account-type items, registration fee, credit bundles).

### ⬆ Rate limiting will fail closed

V1's limiter **fails open** when Upstash is unreachable — and it is currently unreachable in production, meaning rate limiting has been silently off. Verified 19 July 2026: every production request logs `rate-limit:check_error "fetch failed"`.

V2 asserts the Upstash variables at build time in production and fails closed on sensitive limiters (auth, payment). A missing or broken limiter will break the build, not the security model.

### ⛔ Violet domain colour retired

`--domain-business` does not exist in V2. Registered Businesses differentiate by **badge, not colour** (D32). V1's violet business hero/header is gone.

### ⛔ Ambient motion removed

`glide-up` (the 22–38s catalogue drift), `border-beam`, `shimmer-slide`, `gradient-x`, and decorative `spin-slow` are deleted and will not return. Motion communicates state; the closed M1–M16 catalogue plus the Field is the entire motion surface.

**Ask for testers:** the logged-out catalogue is now a static masonry with blur-up image loads instead of a drifting gallery. Does it read as calmer, or as broken/static?

### 🔄 Design direction: R2 "Ink & Paper"

V1's warm-white + cyan-forward system moves to a cooler neutral: off-white `#F7F7F5`, near-black navy ink, **navy as the interactive colour**. Cyan is demoted from "the only interactive colour" to three reserved uses — focus ring, logo, and the M13 success moment.

**Ask for testers:** does the navy-primary interface feel more premium, or less obviously clickable than V1's cyan? This is the single highest-risk visual change and the 28 July decision depends on it.

### ⚠ Docs corpus not vendored into the repo

Deferred from S014 pending a source-of-truth decision — see [`docs/README.md`](./docs/README.md). Specs are read from `../TradeLynq-Docs/`; there is exactly one copy.

---

## Open questions for testers

Collected as surfaces land. Current set:

1. Does navy-as-interactive read as clickable? (R2 palette)
2. Does the static catalogue read as calm or as broken? (ambient motion removal)
