---
created: 2026-09-20
updated: 2026-09-20
---

# Setup

Purpose: get a working local environment. Status: provisional — the code these
steps refer to does not exist yet. The first person to create `web/` and
`backend/` should correct this file in the same pull request.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Git | 2.40+ | |
| Node.js | 20 LTS or newer | For the Vite frontend |
| Python | 3.12+ | Backend and ML |
| uv | latest | Python dependency and virtualenv management |

Accounts needed before the app can run end to end: Supabase (project), Render
(deploys), OpenAI (extraction), Google Cloud (sign-in and Calendar). One shared
development Supabase project is enough for the team; pilot data must live in a
separate project from development data.

## Clone

```bash
git clone https://github.com/allenyjl/adaptive-student-planner.git
cd adaptive-student-planner
```

## Frontend

```bash
cd web
npm ci
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:5173
```

Required variables — all of these are compiled into the bundle and are public
by design:

- `VITE_API_URL` — the local or deployed FastAPI base URL
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never add a secret to a `VITE_`-prefixed variable.

## Backend

```bash
cd backend
uv sync
cp .env.example .env         # fill in the values below
uv run uvicorn app.main:app --reload --port 8000
```

Required variables, none of which may be committed:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` — token verification
- `SUPABASE_SERVICE_KEY` — worker only, bypasses row-level security
- `OPENAI_API_KEY` — extraction
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` — Calendar access
- `TOKEN_ENCRYPTION_KEY` — encrypts stored refresh tokens
- `ALLOWED_ORIGINS` — exact frontend origins for CORS

## Worker

```bash
cd backend
uv run python -m app.worker
```

The worker consumes Supabase Queues and needs the privileged credentials above.
Run it alongside the API when testing imports or scheduling.

## Database

Schema changes are files in `supabase/migrations/`, applied with the Supabase
CLI. Never change the schema through the dashboard — the change will not exist
for anyone else.

## Verifying the setup

```bash
./scripts/check.sh
```

This should pass on a clean checkout. If it does not, the failure is a bug in
either the setup or this document — fix one of them rather than working around
it.
