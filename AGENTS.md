# AGENTS.md

Last updated: 2026-09-22

Operating rules for anyone — human or AI agent — working in this repository.

## Read project context

Keep project facts, architecture, and progress in `docs/` and `plan/`, not in this
file or `CLAUDE.md`. Read these sources before working:

1. [README.md](README.md) — onboarding, repository organization, and workflow.
2. [docs/overview.md](docs/overview.md) and relevant
   [decision records](docs/decisions/) — product context and student decisions.
3. [plan/active.md](plan/active.md) — current state, unresolved choices, and the
   next step; follow links to relevant task plans and handoffs.
4. Relevant current documentation in [docs/](docs/), proposed work in
   [plan/](plan/), student-written sources in `team/` when present, and the actual
   code affected by the task.

Check status and approval evidence. A file's location does not make a proposal
binding. Do not install, provision, or scaffold from an unapproved plan.

## Student ownership and decision authority

- Follow the decision authority defined in the [README](README.md). Do not treat
  established repository organization rules as awaiting team ratification.
- AI may read but must not create, edit, move, or delete files under `team/`.
  Students maintain these source records.
- AI may edit all of `docs/`, including `docs/decisions/`, and `plan/` within the
  requested scope, subject to student review. Editing permission does not grant
  decision authority.
- Students own project decisions. AI may research, propose, and implement within
  explicitly authorized scope and delegated discretion; unresolved choices must
  return to students before dependent implementation.
- Do not infer approval from meeting ideas, silence, AI memory, or existing code.
  Accepted records must identify decision makers and explicit approval evidence.
  Acceptance and implementation are separate states.
- Follow relevant accepted decisions and flag contradictions. AI-authored plans
  and documentation cannot establish or override student decisions.
- When maintaining docs from notes, follow the [README workflow](README.md#updating-docs-from-team-notes):
  distinguish decisions from ideas, cite sources, and use the available question
  tool (or chat) to clarify ambiguous or conflicting decisions with their human
  owner before dependent updates. Do not re-confirm explicit authorization or
  treat unanswered questions as approval; continue independent authorized work.
- New decision proposals default to `Proposed`. Accept, reject, supersede, or
  materially change decisions only with explicit evidence from their human owner.
  Preserve prior rationale and link replacements; do not invent consensus.
- Students may edit all areas. Notes establish intent; code and verification
  establish implemented behavior. Keep approval and implementation separate.

## Setup commands

Follow the setup status in [plan/active.md](plan/active.md) and instructions linked
from the [README](README.md). Resolve the relevant
[open planning questions](plan/questions.md) before introducing setup commands;
proposed tools are not authorization to provision services.

## Test and verification commands

```bash
./scripts/check.sh   # everything: lint, typecheck, tests, build
./scripts/test.sh    # targeted tests; pass a path or -k expression
```

Prefer these over ad-hoc commands so CI and local runs stay identical. See
the [README](README.md#verification-today) for current limitations and
[plan/testing.md](plan/testing.md) for proposed testing concerns.

## Code style and conventions

The FastAPI/Pydantic, TypeScript, Supabase, and worker conventions below are
conditional on team approval of that candidate design; they do not select the
stack or architecture. The same qualification applies to stack-specific security
and completion requirements later in this file.

- Python: FastAPI + Pydantic models at every API boundary. Type hints required.
  Business logic lives in plain functions that are callable from both the API
  and the worker — not inside route handlers.
- TypeScript: strict mode. No `any` in committed code.
- Timestamps are stored in UTC; the student's IANA timezone is stored separately
  on their profile. Never infer a timezone from the server clock.
- Duration values are integer minutes throughout the stack.
- Database changes ship as files in `supabase/migrations/`, never as manual edits
  in the Supabase dashboard.
- Every slow operation returns a `job_id` and is executed by the worker. HTTP
  handlers must not call the LLM or the solver inline.

## Git

Full conventions: [docs/git-workflow.md](docs/git-workflow.md). Read it before
your first commit. The rules that bind agents:

- **Never commit unless asked.** Committing is the human's decision.
- **Never `git add -A` or `git add .`.** Stage named files. A blanket add sweeps
  in other people's uncommitted work.
- **Never force-push, rebase, or amend anything already pushed** without explicit
  instruction.
- **Verify before claiming.** `git status` / `git log -1 --stat` and read it.
  Never describe repo state from memory.
- **Conventional Commits**: `type(scope): imperative description`. Body explains
  *why*.
- **Keep the diff to the request.** No opportunistic cleanup, no unrequested
  dependencies.

## Data and correctness rules

These are project-specific and easy to get wrong. They hold regardless of which
stack we pick, though the first one is phrased in terms of the proposed one:

- **Ownership is enforced server-side.** Whatever the data layer, any privileged
  background path that bypasses per-user access control must re-check ownership
  from the trusted job record before touching a row.
- **Incomplete work is not a duration label.** Time logged against a task that
  was never finished is a lower bound. It may inform features; it must never be
  used as a training target for completed duration.
- **Synthetic data stays labeled.** Simulated tasks and histories are for
  exercising screens and APIs. They must be distinguishable from real student
  records in the database and excluded from any reported accuracy number.
- **Model predictions are logged with their inputs.** Store the prediction, the
  model version, and the features available at decision time. Without that, the
  feedback loop cannot be evaluated later.
- **Imports are idempotent.** Retrying a failed import must not create duplicate
  assignments.

## Do not edit

- `supabase/migrations/*` that have already been applied — add a new migration.
- Lockfiles (`package-lock.json`, `uv.lock`) except as a deliberate dependency
  change with a stated reason.
- Files under `plan/archive/` — they are historical.

## Security and secrets

- No secrets in the repository. `.env` files are gitignored; commit
  `.env.example` with empty values instead.
- Anything prefixed `VITE_` is compiled into the frontend bundle and is public.
  Never put an API key there.
- The OpenAI key, backend-only Supabase credentials, the Google OAuth secret,
  and the token-encryption key exist only in hosting environment settings.
- Google Calendar refresh tokens are stored encrypted at rest.
- Student assignment text is user data. Send only the fields extraction needs,
  and only with consent recorded.

## Definition of done

A change is done when:

1. It does what the linked issue, spec, or `plan/active.md` entry asked.
2. `./scripts/check.sh` passes, and its output is quoted in the commit notes or
   handoff.
3. New behavior has a test; new API surface has a Pydantic schema.
4. Any schema change is a migration and has been applied to a dev project.
5. Docs are updated if system behavior changed — `docs/` describes what is true
   now, not what is planned.
6. If work stopped mid-stream, `plan/active.md` reflects reality.

Do not claim completion from reading the diff alone. Run the checks.
