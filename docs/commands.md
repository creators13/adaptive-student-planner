---
created: 2026-09-20
updated: 2026-09-20
---

# Commands

Purpose: the canonical command for each routine task, so local runs, CI, and AI
agents all do the same thing. Status: provisional — commands marked *(planned)*
have no code behind them yet.

Prefer these over ad-hoc invocations. If a command here is wrong, fix the
command or fix this file; do not route around it.

## Verification

| Command | Does |
|---|---|
| `./scripts/check.sh` | Everything: lint, typecheck, tests, build. The gate before any pull request. |
| `./scripts/test.sh` | Targeted tests. Accepts a path or a `-k` expression. |

## Frontend *(planned)*

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Production bundle into `web/dist` |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests |

Run from `web/`.

## Backend *(planned)*

| Command | Does |
|---|---|
| `uv run uvicorn app.main:app --reload --port 8000` | API with hot reload |
| `uv run python -m app.worker` | Background worker |
| `uv run pytest` | Test suite |
| `uv run ruff check .` | Lint |
| `uv run mypy app` | Type check |

Run from `backend/`.

## Database *(planned)*

| Command | Does |
|---|---|
| `supabase migration new <name>` | Create a migration file |
| `supabase db push` | Apply pending migrations to the linked project |
| `supabase db reset` | Rebuild a local database from migrations |

Applied migrations are immutable. Correct a mistake with a new migration.

## Machine learning *(planned)*

| Command | Does |
|---|---|
| `uv run python -m ml.train` | Train the duration model on consented records |
| `uv run python -m ml.evaluate` | Error and calibration against held-out later tasks |

Run from `backend/`. A model is promoted only after evaluation, and the
previous artifact is kept for rollback.

## End-to-end tests *(planned)*

| Command | Does |
|---|---|
| `npx playwright test` | Sign-in → task → schedule → feedback flow |
