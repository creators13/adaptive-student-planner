---
created: 2026-09-20
updated: 2026-09-20
---

# 0001 — Stack selection

Status: Accepted (2026-09-20). Not yet provisioned.

## Context

A two-semester, five-to-six-person student project with a small reimbursement
budget, a pilot-scale user base, and a hard requirement for a working hosted
prototype by the Fall midpoint. The team needs parallel ownership across
interface, backend, imports, prediction, scheduling, and evaluation.

## Decision

React + TypeScript + Vite on the frontend, FastAPI + Pydantic on the backend,
both hosted on Render; Supabase for auth, Postgres, and private storage;
Supabase Queues plus a Render background worker for slow jobs; the OpenAI
Responses API with Structured Outputs for assignment extraction; scikit-learn
and Google OR-Tools on CPU for prediction and scheduling.

## Reasons

- **One language for the interesting parts.** Prediction, scheduling, and the
  API are all Python, so the optimization and ML work does not have to cross a
  service boundary to reach the data it needs.
- **Managed auth with row-level security.** Supabase provides per-row
  authorization in the database rather than in application code, which is the
  right place for it in a multi-user system built by a large team under time
  pressure.
- **CPU is sufficient.** A quantile-regression duration model over per-student
  task histories does not need a GPU. This keeps hosting inside the
  reimbursement budget and avoids provisioning delay.
- **Deployable in week one.** Render static site plus web service plus worker
  covers all three runtime shapes without container orchestration.

## Alternatives considered

- **Next.js full-stack.** Rejected: it would put the scheduling and ML code
  behind a language boundary or force a second service anyway.
- **Self-managed Postgres and hand-rolled auth.** Rejected: authorization bugs
  are the most likely way this project leaks student data, and hand-rolling it
  spends the team's scarcest resource on a solved problem.
- **AWS.** The course offers AWS credits, but the relevant funding here is the
  separate reimbursement budget, and AWS setup cost in team hours is higher than
  its savings at this scale. Revisit only if hosting costs exceed the budget.
- **A GPU-backed fine-tuned extraction model.** Deferred. Prompting with
  structured outputs is the baseline; fine-tuning is justified only by a measured
  extraction-accuracy shortfall.

## Consequences

- The worker holds credentials that bypass row-level security, so ownership
  checks in worker code become a first-class security concern.
- Extraction cost scales with import volume; the model ID stays configurable so
  it can be swapped after a small accuracy-versus-cost evaluation.
- Render free tiers sleep. Pilot testing needs a paid instance or a warm-up
  path, budgeted before the study starts.

## Revisit when

Hosting cost exceeds the reimbursement budget, extraction accuracy proves
insufficient with prompting alone, or scheduling exceeds what CP-SAT can solve
in acceptable time for a realistic week.
