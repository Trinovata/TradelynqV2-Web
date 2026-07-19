# Agents — Read Me First

Eleven agent definitions, each a `.md` with frontmatter (`name`, `description` with its triggers, `tools`, **`model`** — Opus for judgement, Sonnet for grounded work). Install via `..\install.ps1`; they appear as subagent types in Claude Code sessions in that repo.

**Routing card:** status/audit → `project-steward` (Sonnet) · break work down → `task-master` (Opus) · execute a tracker task → `task-executor` (Sonnet; tracker's model column overrides) · define BEFORE building → `experience-definer` (Opus — nothing enters a tracker without it) · backend/money/migrations → `backend-architect` (Opus) · UI/design → `frontend-craftsman` (Opus) · review/gate → `qa-gatekeeper` (Opus, mandatory before "done") · docs sync → `docs-librarian` (Sonnet) · orchestration design → `workflow-architect` (Opus) · n8n flows → `n8n-builder` (Sonnet) · deploys/incidents → `release-captain` (Sonnet).

All eleven are bound by `..\skills\operating-manual\` (the constitution). Full operating model + quality bar: [../README.md](../README.md).
