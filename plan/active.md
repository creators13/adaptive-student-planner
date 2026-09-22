# Active work

Status: Active

Purpose: record current work, unresolved decisions, and the next authorized step.
Repository organization and development rules live in the [README](../README.md).

## Confirmed state

- Project direction: adaptive student planner; team and adviser confirmed.
- Product scope, stack, architecture, and first-feature acceptance criteria remain
  undecided. No application code or provisioned services exist.
- Allen owns repository organization and operating rules. The current Git policy
  allows direct commits to `main`; branches, PRs, branch protection, and templates
  are intentionally not required.
- `team/meetings/` exists locally and is empty; Git does not track empty folders.
  AI reads `team/` and may edit all of `docs/`, but humans make the decisions.
- Current branch: `main`. Allen has authorized the organization commit.

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

## Next step

Review and commit the repository organization directly to `main`. Then work
through [questions.md](questions.md), starting with the first version's scope,
MVP acceptance criteria, and the stack needed for it. Record explicit human
choices before implementation; ask about ambiguous source notes rather than
inferring approval. No first feature or delivery schedule is selected here.
