# Adaptive Student Planner

Last updated: 2026-10-04

A student planner that schedules your work for you and learns how long it actually
takes. You add assignments and other tasks, the system estimates the effort each one
needs and places it in your free time, asks how each session went, and uses that
feedback to improve future estimates. See [docs/overview.md](docs/overview.md).

Built as a UPenn CIS 4000/4100 senior project (Fall 2026 – Spring 2027).

This README explains how the team shares context, records decisions, and develops
with AI assistance. Allen sets the repository organization, context ownership,
and AI editing boundaries below. These are established rules for contributors,
not proposals awaiting team ratification. Changes to them require Allen's approval.

## Project status

First draft of the web app, on branch `hxu/ui-first-pass` for team review. It runs in
the browser with sample data and a demo clock; there is no backend yet.

| | |
|---|---|
| Direction | Decided |
| Team | Formed |
| Adviser | Confirmed |
| **Frontend** | **Proposed:** React + TypeScript ([decision 0001](docs/decisions/0001-frontend-react-typescript.md)), accepted or rejected with the pull request |
| **Backend and the rest of the stack** | **Not decided** ([question 4](plan/questions.md)) |
| **Architecture** | **Not decided** |

Start with the [open planning questions](plan/questions.md) before choosing or
provisioning further tools. The scope and metrics in [the overview](docs/overview.md)
also await team review.

## Run the app

Needs [Node.js](https://nodejs.org/) 22.22 or newer.

```bash
cd web
npm install    # once, and again when package.json changes
npm run dev    # then open the address it prints
```

[web/README.md](web/README.md) walks through trying both flows.

## Start here

1. Read this page for organization and ownership.
2. Read [AGENTS.md](AGENTS.md) for shared operating rules and
   [docs/git-workflow.md](docs/git-workflow.md) before your first commit.
3. Read [docs/overview.md](docs/overview.md) for the product direction, checking
   which sections are still drafts.
4. Read [plan/active.md](plan/active.md) for current work, then the relevant
   decision record, task, and plan before making changes.

## Where things live

| Location | Purpose | Editing responsibility |
|---|---|---|
| `team/meetings/` | Dated meeting summaries: decisions, ideas, questions, actions | Students only; AI may read |
| [docs/](docs/) | Current project knowledge, system behavior, and workflow | Students or AI may edit all contents, with student review |
| [docs/decisions/](docs/decisions/) | Significant choices, rationale, status, and approval evidence | AI may document decisions; humans make and authorize them |
| [plan/](plan/) | Research, proposals, implementation plans, and handoffs | Students or AI; proposals require authorization before implementation |
| [AGENTS.md](AGENTS.md) | Shared instructions for coding agents | Changes directed and reviewed by students |
| [CLAUDE.md](CLAUDE.md) | Imports `AGENTS.md` and adds Claude-specific guidance | Changes directed and reviewed by students |
| [scripts/](scripts/) | Repeatable verification commands | Students or AI, with student review |
| [web/](web/README.md) | The web app (proposed: React, TypeScript, Vite); its README and design record | Students or AI, with student review |
| [plan/uiux/](plan/uiux/ui-ux.md) | UI/UX proposals: principles, the scheduling flows and rules, validation | Students or AI; proposals require authorization before implementation |

`team/meetings/` holds dated meeting summaries written by students. A backend directory
will be chosen with the rest of the stack.

The separation preserves student-authored sources in `team/` while letting AI
maintain all documentation and plans. Students can edit every area. No folder
belongs to AI. Meeting notes establish intent; code and verification establish
what is implemented. Documentation should reflect both without conflating them.

Keep agent instruction files focused on operating rules and links. Product facts
and accepted choices belong in `docs/`; current progress and unresolved work
belong in `plan/active.md`. Do not duplicate project status or architecture in
`AGENTS.md` or `CLAUDE.md`.

## Who makes decisions

Allen owns decisions about repository organization and its operating rules.
Teammates can suggest improvements; changing these rules requires his approval.
Product scope, architecture, technology choices, dependencies, and data use remain
student decisions, with unresolved choices tracked separately in `docs/` and
`plan/`. AI may research, compare alternatives, explain tradeoffs, and implement
authorized work. It cannot approve its own proposals.

- **Student-only sources:** AI must not create, edit, move, or delete files under
  `team/`. It reads these records as sources for documentation updates.
- **AI-editable documentation:** AI may create and edit any content in `docs/`,
  including decision records, within an authorized task. It can record a human
  decision without becoming its decision maker.
- **Explicit authorization:** Before implementation, the student task owner
  specifies scope and any implementation discretion delegated to the agent.
  Unresolved decisions go back to students; silence is not approval.
- **Visible provenance:** Accepted decisions identify the students who decided,
  why they chose that option, alternatives considered, and approval evidence
  such as a commit, issue, or student-confirmed meeting record.
- **Separate status from implementation:** `Proposed` is under discussion;
  `Accepted` is approved; `Rejected` was explicitly declined; `Superseded` links
  to its replacement. Track implementation separately: an accepted choice may
  not be built yet. New AI-drafted choices default to `Proposed`; explicit human
  authorization is required to record acceptance, rejection, or supersession.
- **Resolve conflicts explicitly:** A file's location, a recent timestamp, an AI
  memory, or existing code does not prove approval. Flag contradictions against
  accepted decisions rather than silently choosing a new direction.

Use a decision record for choices that affect the wider project. Explain smaller
implementation choices in the task or commit. Keep current documentation aligned with
accepted decisions, and label remaining assumptions as proposals.

These are editing rules, not technical access controls. GitHub protection settings
must be configured separately; this README does not enforce them.

## After a meeting

Continue using Google Docs for live notes. After each meeting, a student adds a
concise summary at `team/meetings/YYYY-MM-DD-topic.md` containing:

- Meeting date, attendees, source Google Doc link, and review status.
- Confirmed decisions, with links to decision records where appropriate.
- Ideas discussed but not approved, and unresolved questions.
- Action items with student owners and task links when available.

Ask another attendee to check the summary. Reviewing notes for accuracy does not
approve every idea in them. AI can then maintain `docs/`, including decision
records, using the process below. Meeting notes remain historical context, not a
replacement for current decision records. Exclude credentials and private student
data from notes.

### Updating docs from team notes

When asked to incorporate new notes, the agent follows this workflow:

1. **Read and compare.** Read the relevant `team/` notes, existing docs and
   decisions, and implementation evidence when describing working behavior.
2. **Classify the content.** Separate explicit human decisions, proposals, open
   questions, and action items. Identify affected docs and contradictions.
3. **Interview only where needed.** Use the available question tool, or concise
   chat questions, to resolve missing, ambiguous, or conflicting decisions with
   the appropriate human owner. Bundle related questions, show the source wording,
   and ask neutrally. Do not ask again when authorization is already explicit.
4. **Wait on dependent changes.** Silence, a preselected answer, or an unanswered
   question is not approval. Leave the point unresolved and continue independent
   authorized updates. One person's answer must not be presented as team consensus.
5. **Update the docs.** Link consequential changes to the source note, issue, or
   commit. For a direct human clarification, record who decided and what they explicitly
   authorized; never invent a source link or rationale. Preserve approved meaning
   and prior rationale; link superseding decisions rather than erasing history.
   Keep proposed choices and unimplemented decisions clearly labeled.
6. **Present the diff for student review.** Summarize documentation changes,
   their sources, and remaining questions. Follow the current commit rules.

For example, “Postgres seems easiest” is an option assessment. Before recording
an accepted stack decision, ask: “Was PostgreSQL selected, or is it still a
candidate?” Clearly recorded authorization from the decision owner needs no
additional interview. Allen owns repository organization decisions; other choices
must be attributed to their actual human owners.

A reusable request:

> Read the new notes in `team/` and compare them with current docs. Identify
> documentation changes and unresolved decisions. Interview me about ambiguities
> before dependent updates, then update `docs/`. Keep proposals labeled, link
> sources, and leave `team/` unchanged.

## How we develop

1. **Define the task.** Assign a student owner and record the intended behavior,
   acceptance criteria, relevant decisions, and what is out of scope in an issue
   or focused plan. Resolve decisions the implementation depends on first.
2. **Use a focused change.** A branch is optional; direct commits to `main` are
   allowed. Inspect existing changes before editing and keep unrelated work out
   of the diff.
3. **Implement in reviewable steps.** Give agents bounded tasks and read their
   changes as they work. Review new dependencies, behavior changes, and changes
   to tests explicitly. The student author must understand and explain the code.
4. **Verify behavior.** Run the project scripts below. Check error paths and the
   acceptance criteria, not just the happy path. Record commands, results, and
   checks that were skipped. Do not weaken tests to obtain a passing result.
5. **Review the diff before committing.** Include the task, rationale, relevant
   decisions, verification evidence, and any remaining risks in the commit notes
   or handoff. Review the actual diff, including tests and documentation. AI review
   supplements student judgment.
6. **Commit and update context.** Update `docs/` when behavior changes. Before
   handing off unfinished work, record progress and the next step in
   `plan/active.md` or a linked task handoff.

Use Conventional Commit messages such as `docs(repo): explain context ownership`.
Stage named files; avoid blanket staging. Agents may commit only when asked.
Never commit credentials, `.env` values, or real student records.

When working concurrently, assign separate tasks and branches. Separate agent
sessions that write concurrently should use separate worktrees or clones.
Coordinate shared configuration, dependency files, and migrations. Keep
`plan/active.md` brief and link separate task handoffs as parallel work grows.

### Current Git policy

The [current Git workflow](docs/git-workflow.md) allows direct commits to `main`.
Pull requests, branch protection, CODEOWNERS, and required peer approvals are not
part of this project workflow. Everyone has already been added to GitHub.

## Verification today

```bash
./scripts/check.sh   # everything: lint, typecheck, tests, and build of web/
./scripts/test.sh    # targeted tests: a path or a test-name filter
```

Run `npm install` in `web/` first. `check.sh` checks the web app for real; the backend
section is skipped because there is no backend yet, so an exit code of zero does not cover
one. The backend commands in the scripts are candidates to review when the team chooses
the backend. [plan/testing.md](plan/testing.md) lists proposed testing concerns.

## Remaining setup

- Share the established organization and operating rules with teammates.
- Team review of the project scope and the proposed MVP flows
  ([docs/overview.md](docs/overview.md), [plan/uiux/user-flows.md](plan/uiux/user-flows.md)).
- Student-created meeting summaries, followed by reviewed documentation and
  decision updates using the clarification workflow above.
- Meeting and PR templates are intentionally not used.
- Review the web app's frontend stack ([decision 0001](docs/decisions/0001-frontend-react-typescript.md))
  with its pull request.
- Resolve the remaining [open planning questions](plan/questions.md), then document the
  backend, the first implementation plan, and its setup instructions.
