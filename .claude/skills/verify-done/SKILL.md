---
name: verify-done
description: The completion gate — verification-before-completion, TradeLynq edition. Use BEFORE claiming anything is done, fixed, passing, or ready; before any commit, PR, or status update; whenever the words "should work" are about to be typed. Evidence before assertions, always.
---

# Verify Done

> **Model: Sonnet (or whatever the session runs)** — verification is running commands and reading output; the discipline is the value, not the model.

**The Iron Law: no completion claims without fresh verification evidence.** If the command wasn't run in this session with its output read, the claim cannot be made. Violating the letter is violating the spirit.

## The gate function (run it verbatim)

1. **IDENTIFY** — what command or check proves this specific claim?
2. **RUN** — execute it fully, fresh, now. Not the cached run, not the partial run.
3. **READ** — the whole output; exit code; count the failures yourself.
4. **VERIFY** — does the output confirm the claim? No → state the actual status with the evidence. Yes → state the claim **with** the evidence.
5. Only then claim. A skipped step means the claim is a guess wearing a suit.

## The TradeLynq evidence table

| Claim | Requires (fresh) | Never sufficient |
|---|---|---|
| Code done | `npm run typecheck` 0 errors + `npm run lint` 0 warnings + task's tests green | "compiles in my head", previous run |
| Production-ready | `npm run build` exit 0 | lint passing |
| Bug fixed | the original symptom re-tested and gone | code changed |
| Route safe | guard tests: wrong-role/unauth/gate cases return the exact taxonomy codes | reading the handler |
| UI done | both themes + 375px screenshots; loading/empty/error demonstrated; strings match the copy deck | desktop light-mode looks fine |
| Migration safe | applied on a scratch DB; RLS policies present; types regenerated | SQL reads correctly |
| Docs updated | the named files diffed, or the explicit verdict "none needed" | "docs probably fine" |
| Subagent finished | its artefact on disk, opened and read; tracker row true | the agent's success message (they die at the return step — the file is the truth) |
| Tracker accurate | ✅ rows spot-verified against artefacts | the table says so |

## Red flags — stop and run the gate

"Should / probably / seems to" · satisfaction before verification ("Perfect!", "Done!") · about to commit/push/PR without the gate · trusting an agent's report · tired and wanting it over · any wording implying success without output on screen.

## Rationalisations, pre-refuted

"I'm confident" → confidence isn't evidence. "Just this once" → no exceptions; the system's reliability *is* the no-exceptions. "The linter passed" → linter ≠ compiler ≠ runtime ≠ behaviour. "Partial check is enough" → partial proves nothing. "Different words, so the rule doesn't apply" → spirit over letter, always.

**Honest failure reporting is a pass of this skill:** "X fails with <output>; root cause unknown yet" is compliant. "X should be working now" is not.
