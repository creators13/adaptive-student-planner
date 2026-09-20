---
created: 2026-09-20
updated: 2026-09-20
---

# Active work

## Status

Active

Purpose: the single source of truth for what is in flight right now. Any agent
or teammate picking up work reads this first and updates it before stopping.

## Current task

Repository bootstrap — establish project context so implementation can begin
without relying on chat history.

## Current branch

`main`

## Goal

A repository that a coding agent or a teammate can open cold and start building
from: stated problem, chosen architecture, known constraints, build order, and
verification commands.

## Files touched

- `README.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`
- `docs/overview.md`, `docs/architecture.md`, `docs/setup.md`,
  `docs/commands.md`, `docs/testing.md`, `docs/decisions/0001-stack-selection.md`
- `plan/active.md`, `plan/roadmap.md`, `plan/backlog.md`
- `scripts/check.sh`, `scripts/test.sh`

## Complete

- Project context, architecture, and stack rationale written down
- Verification entry points created as dispatchers that no-op cleanly until
  `web/` and `backend/` exist

## In progress

Nothing.

## Not started

Everything in [roadmap.md](roadmap.md). The next milestone is M0 — design the
main workflow in Figma and choose the repository's first vertical slice.

## Commands run

`./scripts/check.sh` — passes trivially; there is no code to check yet.

## Known failures

None.

## Important context

- No application code, Supabase project, Render service, or API key exists yet.
  Every command in `docs/setup.md` and `docs/commands.md` marked *(planned)* is
  aspirational until the corresponding code lands.
- Detailed research behind the product decision — user demand evidence,
  competitor scan, and the course's project criteria — lives in the team's
  local planning notes, not in this repository.

## Next recommended step

Pick the first vertical slice (M1) and write it up as `plan/specs/001-*.md`
before writing code. The recommended slice is: authenticated sign-in, create a
task, start and stop a timer, reload the page and see it persisted — deployed,
not local-only. It touches every layer, which is what makes it worth doing
first.
