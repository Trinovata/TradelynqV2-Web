# TradeLynq V2 — Web Platform

The V2 website + API, built ground-up per `docs/REBUILD-PLAYBOOK.md` against the specs in `../TradeLynq-Docs`. The original app lives in `../Tradelynq` — **reference only: read it, never modify it.**

- **Build state:** the playbook's tick-boxes (`../Tradelynq/docs/REBUILD-PLAYBOOK.md`)
- **Session protocol:** `../MASTER-PROMPT.md`
- **V1 comparison log:** [`V1-DELTA.md`](./V1-DELTA.md) — kept current as surfaces land

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Database / Auth | Supabase (PostgreSQL + RLS + Auth + Storage) |
| Styling | Tailwind CSS v4 + CVA, semantic tokens only |
| Forms | react-hook-form + zod |
| Payments | Stripe (subscriptions), WiPay (one-time) |
| Email | Resend |
| Rate limiting | Upstash Redis (**fail-closed** on sensitive routes) |
| Observability | Sentry + PostHog |

## Commands

```bash
npm run dev         # local dev server
npm run typecheck   # tsc --noEmit — must be clean before any commit
npm run lint        # eslint — must be clean before any commit
npm run build       # production build — required for production-facing work
npm run format      # prettier
```

## Working rules (short form)

Commonwealth English · money as `TTD $X,XXX` via `formatTTD()` · people are **Customers** and **Professionals** (never "service providers", "tradespeople", "contractors", "gig workers") · semantic tokens only, never literal hex in components · every migration RLS-enabled, forced, with policies in the same file · route order: rate-limit → auth/gate → legal → zod → RLS client · loading/empty/error states on every data surface · mobile-first at 375px, both themes first-class.

Full canon: `../First Shot Resources/skills/first-shot/SKILL.md`. Constitution: `../First Shot Resources/skills/operating-manual/SKILL.md`.
