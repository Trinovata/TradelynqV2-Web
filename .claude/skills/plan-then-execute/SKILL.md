---
name: plan-then-execute
description: The house planning-and-execution discipline — writing-plans + executing-plans + subagent-driven-development blended for TradeLynq. Use for any multi-step build before touching code - "plan this feature", "how do we build X", or when a task obviously spans multiple sessions. Produces a tracker a stranger could execute, then executes it one task at a time.
---

# Plan Then Execute

> **Model: Opus 4.8 for Phase 1 (planning is judgement); Sonnet acceptable for Phase 2** when tasks are well-specced — the tracker's model column governs per task.

## Phase 1 — Plan (never skip to code on multi-step work)

1. **Ground:** run `first-shot`; read the governing spec chapter + detail files. No spec? Stop — spec first (or flag to Gregg). Planning against vibes is how scope invents itself.
2. **Write the plan for a zero-context engineer with questionable taste** (the writing-plans standard): exact files to create/modify with paths, the test to write first where code is involved, the command that proves each step, docs that must move. Assume they know the language but not this codebase or domain.
3. **Bite-size the steps** — one action each, 2–5 minutes: "write the failing test" / "run it, expect FAIL" / "implement minimally" / "run it, expect PASS" / "commit". TDD where behaviour changes; DRY; YAGNI — plan nothing the acceptance criteria don't require.
4. **Session-size the tasks** (the completion-first policy): each task finishable in one sitting; bigger → named Parts, each independently shippable. Give each task its **Done when** (acceptance criteria + verification command) and its dependencies.
5. **Save it** as a TASKS tracker (`task-master` format) at `docs/plans/YYYY-MM-DD-<name>.md` (or extend an existing tracker). The plan header states goal, architecture in 2–3 sentences, and the execution policy block.

## Phase 2 — Execute (one task at a time, evidence always)

1. Take the topmost open task (or the one assigned). Dependencies unmet → stop and say so.
2. Build exactly to the task's steps. Discovering the plan is wrong mid-task is normal: **stop, amend the plan first, then continue** — silent divergence is the only forbidden move (record material changes as a Flags note or D-entry).
3. Verify with the task's named commands, fresh, output read (the verify-done Iron Law).
4. Land durably: work on disk, tracker row flipped with date + note, docs touched or "none needed" stated.
5. Commit at every green step boundary (small commits, message says why). Then the next task — or stop, if the session's one task is done and that's the policy in force.

## When to fan out instead

≥3 tasks with no shared state and no ordering → hand the tracker to **workflow-architect** for a wave-fleet; the plan format is already fleet-ready (that's deliberate). Judgement between stages → stay sequential; a human or **project-steward** reads between phases.

## Anti-patterns this skill exists to kill

Planning in chat with no saved artefact · tasks sized "however long it takes" · steps that name no verification · executing while re-designing · finishing 80% of three tasks instead of 100% of one.
