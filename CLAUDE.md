# TradeLynq V2 — Web Platform

Professional-services marketplace for Trinidad & Tobago (Trinovata). **Customers** browse and engage free; **Professionals** subscribe for visibility and operating tools. Trust is the product — ranking is earned, never bought.

This is the **ground-up V2 build**. The V1 app in `../Tradelynq` is **reference only: read it to understand behaviour and port proven logic — never modify, commit to, or delete it.**

## ⚠️ This is NOT the Next.js you know

Next.js 16 has breaking changes — APIs, conventions, and file structure may all differ from your training data. **Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.** Heed deprecation notices. Do not assume Next 14/15 patterns still apply.

## Where the truth lives

| Question | Source |
|---|---|
| What am I building next? | `../Tradelynq/docs/REBUILD-PLAYBOOK.md` — the S-numbered queue, and the tracker |
| How do I work? | `../MASTER-PROMPT.md`, and `../First Shot Resources/skills/operating-manual/SKILL.md` (the constitution) |
| What does this surface do? | `../TradeLynq-Docs/v2/` chapters 01–17 |
| Exact strings, contracts, props | `../TradeLynq-Docs/v2/details/` — copy decks, API packs, component contracts |
| How does it look? | [`DESIGN.md`](./DESIGN.md) — read before any visual decision |
| Why was this decided? | `../TradeLynq-Docs/v2/12-DECISIONS-AND-OPEN-QUESTIONS.md` — never contradict a D-number |
| What changed vs V1? | [`V1-DELTA.md`](./V1-DELTA.md) — keep current as surfaces land |

**Precedence:** code beats docs on what *exists*; docs beat code on what V2 *builds*; detail file > chapter > book. A contradiction between spec and V1 is a **flag, not a judgement call** — log it, never silently resolve it.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript strict (`noUncheckedIndexedAccess`) |
| Database / Auth | Supabase — PostgreSQL, Auth, Storage, RLS |
| Hosting | Vercel (`iad1`, co-located with Supabase `us-east-1`) |
| Styling | Tailwind CSS v4 + CVA, semantic tokens only |
| Forms | react-hook-form + zod |
| UI primitives | Radix UI |
| Icons | lucide-react |
| Payments | Stripe (recurring), WiPay (one-time), FAC (planned) |
| Email | Resend |
| Rate limiting | Upstash Redis — **fail-closed** on auth/payment |
| Observability | Sentry, PostHog, custom activity logging |

## Commands

```bash
npm run dev
npm run typecheck      # must be clean before any commit
npm run lint           # must be clean before any commit
npm run build          # required for production-facing work
npm run format
npx supabase migration new <name>
npx supabase db push
```

## The canon (non-negotiable)

**Language**
- Commonwealth English: colour, organisation, enquiry, recognise, licence (noun).
- People are **Customers** and **Professionals**. Never "gig workers", "service providers", "tradespeople", or "contractors" — in UI copy, comments, or variable names where user-facing.
- Money always renders `TTD $X,XXX` via `formatTTD()`. Never bare numbers, never USD in UI.
- No emoji in UI.

**Pricing v3.1** — `lib/constants/pricing.ts` is the single source of truth; pages render from it, never hardcode.
- Presence TTD $200 · Growth $700 · Studio $1,300 · Pro $2,100 · Enterprise $3,500+ monthly.
- **Crossover model:** Registered Business = tier + TTD $100/mo flat, forever. Unregistered sole trader = tier for 6 paid months, then + TTD $150/mo.
- **Pioneer:** first 180 professionals (max 3 per child category, backstop 7 Jan 2027) get 3 months free. The registration fee (TTD $200, student $100) still applies.

**Backend law**
- Route sequence, in this order, always: **rate-limit → auth/role/gate → legal → zod → RLS client.**
- Error codes come from the canonical taxonomy (`lib/api/errors.ts`) only — never ad-hoc strings.
- Every migration: RLS **enabled + forced + policies in the same file**, indexes on FKs and filter columns, `types/database.ts` regenerated and committed in the same commit.
- Service-role key is **server-only** (`import 'server-only'`). Never in a client component.
- Idempotency on anything reachable twice (webhooks, token pages, payment callbacks).
- Never read or write `.env*` or secrets from an agent task. Variable *names* from `.env.example` are fine; values are not.

**Design law** — see [`DESIGN.md`](./DESIGN.md). Semantic tokens only, no literal hex in components · R2 "Ink & Paper" values · motion M1–M16 only, from `lib/motion.ts` · loading/empty/error on every data surface · mobile-first at 375px · both themes first-class · the anti-slop covenant.

**Dates** — beta 22–23 July 2026 · R2 design decision 28 July · store submission 22 Aug · **launch 7 September 2026**.

## Working discipline

- **Evidence before claims.** Nothing is "done" without fresh command output: typecheck + lint clean, tests green, `npm run build` for production-facing work, screenshots at 375px in both themes for UI. The file on disk is the truth; a success message is not.
- **Specs override memory and improvisation.** The copy decks contain every string — never invent copy a deck already wrote. The API packs define every contract. The component files define every prop.
- **One block per session** unless told to continue; each block fully verified before the next.
- **Docs move with behaviour.** Behaviour-affecting decisions land as D-entries; every session ticks its tracker row with date and evidence.
- Commits go to feature branches with clear messages: `type(scope): what — playbook S###-S###`.

## Review checklist

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` passes (production-facing work)
- [ ] No secret material in logs, responses, or committed files
- [ ] New migrations include RLS policies; `types/database.ts` regenerated in the same commit
- [ ] Queries use the right Supabase client (browser / server / admin)
- [ ] New API routes: rate-limit → auth → legal → zod → RLS client, in that order
- [ ] Currency via `formatTTD()`; numerals in mono
- [ ] Copy uses Customer/Professional language and Commonwealth spellings
- [ ] Loading, empty, and error states exist for new UI
- [ ] Renders at 375px in both themes
