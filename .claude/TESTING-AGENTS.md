# TradeLynq testing agents — pointer

The QA / UAT / authorized-pentest agents for TradeLynq are **Dev-level** and span all three
repos (V1, this V2, and the mobile app). They live at `C:\Users\Gregg\Dev\.claude\agents\`
and are available in any Dev session — this note is a signpost, not a second copy.

- **`tradelynq-qa`** — functional & regression QA (staged: target-lock → smoke → mechanical
  gate → flow regression → cross-device → triage verdict). Executable squad: `squad-qa`.
- **`tradelynq-uat`** — user acceptance (criteria-lock → personas → scripted walkthroughs →
  acceptance matrix → ACCEPTED/REJECTED). Executable squad: `squad-uat`.
- **`tradelynq-pentest`** — authorized security testing, **own assets only**, gated by
  `C:\Users\Gregg\Dev\.claude\routing\SECURITY-ROE.md`. Executable squad: `squad-pentest`.

**Tie-break for this repo (V2 — pre-launch):** the local `.claude\agents\qa-gatekeeper` +
the `verify-done` / `operating-manual` kit are **supreme here**. The Dev-level agents
**feed** that gate — `tradelynq-uat` supplies `qa-gatekeeper`'s Step 5 (spec conformance),
`tradelynq-pentest` supplies security findings — they never override it. Load `first-shot`
before any substantive run. `tradelynq-pentest` should verify the open blockers in
`../audit-2026-09-13/GO_NO_GO.md` are closed.

See `Dev\.claude\routing\ROUTING.md` + `SQUADS.md`. Added 2026-10-06.
