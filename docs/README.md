# Docs — where the specifications actually live

**The specification corpus is not duplicated here.** It lives once, at `../../TradeLynq-Docs/`:

| Path | What it is |
|---|---|
| `TradeLynq-Docs/master/` | The stakeholder book — business, strategy, architecture, money map (13 chapters) |
| `TradeLynq-Docs/v2/` | The V2 build specification — chapters 01–17 |
| `TradeLynq-Docs/v2/details/` | The executable layer — copy decks (every string), API packs (every contract), component contracts (every prop), engine specs, analytics dictionary |
| `TradeLynq-Docs/v2/12-DECISIONS-AND-OPEN-QUESTIONS.md` | The decisions register (D-numbers). Never contradict one. |
| `../Tradelynq/docs/REBUILD-PLAYBOOK.md` | The S-numbered build queue **and** its own tracker |
| `../Tradelynq/docs/BUILD-KICKOFF.md` | Track state and the G4 definition of production-ready |

## Why it isn't vendored in yet

Playbook **S014** says to bring the entire docs corpus into this repo. That is deferred deliberately, and the deferral is a **flag for Gregg, not a silent decision**:

Copying ~50 spec files into `Tradelynq-V2/docs/` while `TradeLynq-Docs/` remains the authoring location creates two copies that drift the moment anyone edits either one. Drift in a specification corpus is worse than an inconvenient relative path, because a stale copy still reads as authoritative.

**The vendoring becomes correct at repo-split time** — when `Tradelynq-V2` becomes a standalone GitHub repo (playbook S001) and `../TradeLynq-Docs` no longer resolves. At that point the corpus should be brought in by one of:

1. **Git submodule** pointing at a `TradeLynq-Docs` repo — single source, explicit version pin. *(Recommended.)*
2. **A sync script** (`scripts/sync-docs.ts`) with a CI check that fails when the vendored copy diverges from source.
3. **A one-time copy** with `TradeLynq-Docs/` retired as an authoring location the same day — acceptable only if the corpus stops being edited outside this repo.

Until that decision is made, this repo reads the specs at `../../TradeLynq-Docs/` and there is exactly one copy of the truth.

## What *does* live in this folder

Build artefacts specific to the V2 implementation — migration notes, schema deltas from V1, ADRs that are too small for a D-number, runbooks. Not specifications.
