# Active work

Status: Active

Purpose: record current work, unresolved decisions, and the next authorized step.
Repository organization and development rules live in the [README](../README.md).

## Confirmed state

- Project direction: adaptive student planner; team and adviser confirmed.
- Product scope, stack, architecture, and first-feature acceptance criteria remain
  undecided. No application code or provisioned services exist. The one exception is
  a dependency-free UI prototype under [prototype/](../prototype/README.md) on
  `hxu/ui-first-pass`. It is a proposal, not a stack decision (see below).
- Allen owns repository organization and operating rules. The current Git policy
  allows direct commits to `main`; branches, PRs, branch protection, and templates
  are intentionally not required.
- `team/meetings/` exists locally and is empty; Git does not track empty folders.
  AI reads `team/` and may edit all of `docs/`, but humans make the decisions.
- The organization commit went to `main` (authorized by Allen). Howard's UI work is on
  `hxu/ui-first-pass`; its commits are drafts for team review.

## Current task and completed work

Planning cleanup authorized by Allen:

- Deleted the unapproved architecture, setup, command, and stack-selection files.
- Replaced the roadmap and backlog with [open planning questions](questions.md),
  removing their milestone schedule, feature commitments, and claimed exclusions.
- Reduced [testing.md](testing.md) to proposed correctness and evaluation concerns,
  without selecting tools, services, or model metrics.
- Repaired README, agent-instruction, and test-script references. Added a short
  [decision-record guide](../docs/decisions/README.md) so the directory remains
  discoverable without retaining the unapproved stack proposal.

The README and agent rules already document context ownership and the workflow
for clarifying ambiguous decisions before updating docs.

## Files touched by this cleanup

- Updated: `README.md`, `AGENTS.md`, `plan/active.md`, `plan/testing.md`,
  `scripts/test.sh` (its planning-reference message only).
- Added: `plan/questions.md`, `docs/decisions/README.md`.
- Deleted: `plan/architecture.md`, `plan/setup.md`, `plan/commands.md`,
  `docs/decisions/0001-stack-selection.md`, `plan/roadmap.md`, `plan/backlog.md`.

Other existing setup changes remain in the working tree and index.

## Verification

- `git diff --check` — no whitespace errors.
- Python link check — all 42 local links and anchors across the six affected
  Markdown files resolve.
- `./scripts/check.sh` — exit 0; `sections run: 0` and
  `Nothing was verified. There is no application code in this repository yet.`
- `./scripts/test.sh` — exit 0; `No backend/ directory yet — nothing to test.`
  The printed planning reference now points to this handoff.
- Reference search — deleted paths appear only in the deletion inventory above.

Application lint, typecheck, tests, and build were skipped because application code
does not exist. No commit or GitHub configuration change was made.

## Remaining work and limitations

- Add student-written meeting summaries when meetings begin.
- Branch protection, PR workflow, and templates are intentionally not used.
- The overview still contains explicitly unratified scope and success criteria.
  Agent conventions and script internals also retain conditional assumptions
  about particular tools. They are not a stack decision; further cleanup needs
  a scoped review rather than silently deleting additional material.
- No application lint, typecheck, build, or test coverage exists yet.

## UI first pass (proposed, branch `hxu/ui-first-pass`)

Status: Proposed, waiting for a PR and team review. Not adopted by the team. The dated history of this branch
is in [ui-first-pass-changelog.md](uiux/ui-first-pass-changelog.md); the current state is in
the handoff below.

## Handoff: UI first pass (as of 2026-10-04)

**Where things stand.** All UI first-pass work is committed on `hxu/ui-first-pass`:
the goal and first MVP flows (`bffc8d4`), then the prototype and its docs. The branch is
waiting for a PR to `main` and team review. It adds `prototype/` and `plan/uiux/` (`ui-ux.md`,
`user-flows.md`, which moved from `plan/specs/`, and `ui-first-pass-changelog.md`), and
changes `docs/overview.md`, `plan/questions.md`, and this file.

**Read first:** [uiux/ui-ux.md](uiux/ui-ux.md) maps every UI/UX file and its single job.
[uiux/user-flows.md](uiux/user-flows.md) holds the rules that decide when work is
scheduled (two master flowcharts are the source of truth; the smaller charts under them are
derived). [prototype/DESIGN.md](../prototype/DESIGN.md) holds the supporting UI rules and
explains how the prototype implements both. [ui-first-pass-changelog.md](uiux/ui-first-pass-changelog.md)
records what changed and when.

**Vocabulary now in use:** tasks are **anchored** (given a time) or **floating**;
floating tasks are a **class assignment** or **not an assignment**. The scheduler's core is
the **fit check** (also called fill logic).

**How to verify:**

- `node --test prototype/test/engine.test.js`: 31 tests, all passing as of this handoff
  (2026-10-04).
- `./scripts/check.sh` exits 0 but verifies nothing here (it only looks for `web/` and
  `backend/`).
- Open `prototype/index.html` in Chrome and follow the walkthrough in
  [prototype/README.md](../prototype/README.md).
- The Chrome scripts used for browser walkthroughs and for the "no arrow through a box"
  chart check lived in a temporary folder and are gone. DESIGN.md section 13 describes
  both (Chrome DevTools protocol over a WebSocket, no packages); recreate them if needed,
  or ask to add a chart checker to the repo.

**Open, for the team or the next session:**

- Open a PR from `hxu/ui-first-pass` to `main` (Howard decides when; the Git policy
  does not require PRs, so this is a review choice).
- Team review of the prototype and user-flows.md, including its "Still open" list and the defaults chosen
  while building the prototype.
- Placeholders to refine: re-estimation math, preference defaults (question 8), placement
  strategy and re-placing moved work (question 9), per-task scheduling inputs
  (question 10), the LLM.
  Prototype limits to remove later: 28-day "anytime", 8-week never-ending repeats.
- `prototype/` and `plan/uiux/` are not in the README's "Where things live" table;
  Allen owns that table.
- Not decided, and not implied by the prototype: the stack, whether the engine's logic is
  ported or rewritten, how duration is predicted. After reviewing the open choices, the
  students decide whether `prototype/` stays, moves, or is deleted.
- Then, as before: work through [questions.md](questions.md), starting with the first
  version's scope, MVP acceptance criteria, and the stack. Record explicit human choices
  before implementation.

## Next step

Howard opens a PR from `hxu/ui-first-pass` to `main`. The team then reviews
[uiux/user-flows.md](uiux/user-flows.md) and the prototype, and decides what merges. The
repository-organization commit referenced earlier in this file is already on `main`.
