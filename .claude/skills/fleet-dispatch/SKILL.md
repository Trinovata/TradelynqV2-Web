---
name: fleet-dispatch
description: The parallel-work discipline — dispatching-parallel-agents + the wave/limit contingency proven on this project. Use when facing 2+ independent tasks with no shared state - "fan this out", "run these in parallel", "dispatch agents for the remaining items". Covers when to fleet, how to brief, waves, and recovery.
---

# Fleet Dispatch

> **Model: Opus 4.8 for the dispatch design** (harness choice, briefing, sizing); the dispatched units then run Sonnet/Opus per their tracker rows.

## When to fleet (all three must hold)

1. **Independent** — no task needs another's output, no shared write targets (one writer per file, always).
2. **Same shape** — one brief covers them all; a fleet of unlike tasks is just chaos with concurrency.
3. **Specced** — each unit has sources + scope + done-when (a TASKS tracker row). Unspecced work goes to task-master first; fleets amplify ambiguity, never resolve it.

Otherwise: sequential task-executor runs, or a staged pipeline with judgement between stages.

## The dispatch pattern (proven here, scars included)

1. **Brief file on disk** (AUTHORING-BRIEF pattern) — canon, standards, format, hard constraints. Agents read it first; conversation context never reaches a subagent reliably.
2. **Task definitions on disk** (TASKS pattern) — one row + definition per unit, with the model column (Sonnet mechanical / Opus judgement).
3. **Waves of ≤5, abort on full-wave failure** — one wave all failing = capacity is gone; stop burning. Partial wave success = continue.
4. **Artefact-first agents:** each agent's FIRST durable act is writing its file; the structured return is a courtesy copy. (Fleet deaths at the return step lost nothing here because the files were already written — design for that.)
5. **Verify stage after authors:** lexicon/consistency/adversarial verifiers with fix authority on unambiguous issues, escalation on real conflicts. Authors never gate themselves.
6. **Reconcile:** open every artefact (verify-done: the file is the truth, not the report), flip tracker rows, harvest Flags into the register/roadmap.

## Recovery playbook (limits will hit; plan as if mid-run death is certain)

- Run dies → tracker + disk are the state. Next session: re-read brief + tracker, take the topmost ⬜. Nothing depends on the dead chat.
- Some agents wrote before dying → validate those files (proper endings, lexicon grep), mark done, fleet only the gap.
- Capacity gone entirely → same tracker executes inline, one part per session (the tracker format is deliberately identical for fleets and solo runs).
- Capacity returns → the saved wave script resumes; completed rows are skipped by definition because agents rewrite only their own missing files.

## Sizing & cost sanity

Unit ≤ ~450 lines output / one-session scope · fleet ceiling = what the tracker lists, not what feels impressive · state the cost order-of-magnitude before launching (units × model tier) · never fleet what one good session does in an hour — orchestration overhead is real and the simplest harness that fits wins.
