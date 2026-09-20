# AGENTS.md

Last updated: 2026-09-20

Operating rules for anyone — human or AI agent — working in this repository.

## Project summary

Adaptive Student Planner: students enter or import assignments, the system
estimates how long each will take, proposes a weekly schedule the student
approves, logs actual work time, and improves future estimates from that
feedback.

The technically interesting core is not the CRUD app. It is (1) learning
per-student duration distributions from logged work sessions and (2) placing
work blocks under real calendar and deadline constraints. Changes should
protect the integrity of that feedback loop.

## Current state

No application code exists yet. The planned layout is:

```
web/                  React + TypeScript + Vite frontend
backend/app/          FastAPI service and background worker
backend/ml/           Duration model training and evaluation
supabase/migrations/  Versioned schema and policy changes
docs/                 Durable documentation
plan/                 Active work, roadmap, backlog, specs
scripts/              check.sh, test.sh
```

Create these directories as the work reaches them; do not scaffold empty
packages ahead of need.

## Setup commands

Full setup is documented in [docs/setup.md](docs/setup.md). Once the code
exists, the short form is:

```bash
cd web && npm ci                 # frontend deps
cd backend && uv sync            # backend deps (Python 3.12+)
```

## Test and verification commands

```bash
./scripts/check.sh   # everything: lint, typecheck, tests, build
./scripts/test.sh    # targeted tests; pass a path or -k expression
```

Prefer these over ad-hoc commands so CI and local runs stay identical. See
[docs/commands.md](docs/commands.md) and [docs/testing.md](docs/testing.md).

## Code style and conventions

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

## Data and correctness rules

These are project-specific and easy to get wrong:

- **Ownership is enforced server-side.** Row-level security protects user-scoped
  requests, but the worker runs with credentials that bypass it. Worker code must
  re-check ownership from the trusted job record before touching any row.
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
2. `./scripts/check.sh` passes, and its output is quoted in the PR or handoff.
3. New behavior has a test; new API surface has a Pydantic schema.
4. Any schema change is a migration and has been applied to a dev project.
5. Docs are updated if system behavior changed — `docs/` describes what is true
   now, not what is planned.
6. If work stopped mid-stream, `plan/active.md` reflects reality.

Do not claim completion from reading the diff alone. Run the checks.

## More context

- [docs/overview.md](docs/overview.md) — problem, users, scope
- [docs/architecture.md](docs/architecture.md) — services and data flow
- [docs/decisions/](docs/decisions/) — why the stack is what it is
- [plan/roadmap.md](plan/roadmap.md) — build order and milestones
