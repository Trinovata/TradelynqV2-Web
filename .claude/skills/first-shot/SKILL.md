---
name: first-shot
description: The TradeLynq master context loader. Use FIRST in any session that will touch TradeLynq code, docs, or decisions — loads the canon, the documentation map, the current trackers, and the operating rules so the very first output is right. Trigger on "load context", "first shot", or at the start of any substantive TradeLynq task.
---

# First Shot — Load TradeLynq Context

> **Model: any** — this is a context loader; it runs in whatever session invokes it. The session's model should match the *work* that follows (Opus for judgement, Sonnet for grounded execution — see the README routing table).

Load the smallest sufficient context, in this order, before doing anything else:

## 1. The canon (memorise; these override anything older you encounter)

- **Product:** professional-services marketplace for Trinidad & Tobago (Trinovata). Customers free; Professionals subscribe. Trust is the product; ranking is earned, never bought.
- **Pricing v3.1** (`lib/constants/pricing.ts` is truth): Presence TTD $200 · Growth $700 · Studio $1,300 · Pro $2,100 · Enterprise $3,500+ monthly. **Crossover model:** Registered Business = tier + TTD $100/mo flat forever; unregistered sole trader = tier for 6 paid months, then + TTD $150/mo. **Pioneer:** first 180 professionals (max 3 per child category, backstop 7 Jan 2027) get 3 months free; registration fee (TTD $200 / student $100) still applies.
- **Language:** Commonwealth English (colour, organisation, enquiry) · money always `TTD $X,XXX` via `formatTTD()` · people are **Customers** and **Professionals** — never gig workers / service providers / tradespeople / contractors · no emoji in UI.
- **Backend law:** route sequence rate-limit → auth/role/gate → legal → zod → RLS client; error codes from the canonical taxonomy only; migrations always with forced RLS; service-role server-only; idempotency on anything reachable twice.
- **Design law:** semantic tokens only (R2 neutral direction — `docs/v2/02A`); anti-slop covenant (`docs/v2/01` §1.3); motion M1–M16 only; states (loading/empty/error) on every data surface; mobile-first at 375px; both themes first-class.
- **Dates:** beta 22–23 July 2026 · R2 design decision 28 July · store submission 22 Aug · **launch 7 September 2026**.

## 2. The map (read what the task touches)

`docs/EXECUTION-ROADMAP.md` (always — the status + plan) → your surface/domain chapter in `docs/v2/` → its `docs/v2/details/` files (copy decks for strings, api packs for contracts, backend-processes for engines, AUTHORING-BRIEF for doc work) → `docs/master/` only for business/stakeholder questions. Precedence: code beats docs on what *exists*; docs beat code on what *V2 builds*; detail file > chapter > book.

## 3. The trackers (know what's in flight)

`docs/v2/details/TASKS.md` (detail-layer status + execution policy) · `docs/v2/12-DECISIONS-AND-OPEN-QUESTIONS.md` (D1–D55; never contradict a D-number; open questions are Gregg's, not yours to guess).

## 4. The operating rules

**Rule zero — the Operating Manual (`skills/operating-manual/SKILL.md`) governs everything below.** Read it once in full; thereafter the five-question self-test runs on every answer before it ships, the impostor scan runs on every draft, and every claim carries its bin (verified here / recalled / constructed) inside the sentence. Where the manual and any other document conflict, the manual wins.

Completion-first (take only what this session can finish; oversized → task-master) · evidence before claims (verify-done skill; qa-gatekeeper before "done") · every artefact lands on disk + tracker in the same session · docs move with behaviour (docs-librarian) · usage-limit contingency: waves abort on full-wave failure, partial work stands, redo is cheap by design.

**Then state, in two lines, what you loaded and what you're about to do — and do it.**
