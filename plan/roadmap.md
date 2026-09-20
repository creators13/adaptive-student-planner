---
created: 2026-09-20
updated: 2026-09-20
---

# Roadmap

## Status

Accepted

Purpose: the intended build order and what each milestone must demonstrate.
Nothing here is implemented yet. Sequencing matters more than dates: each
milestone exists to make the next one possible.

## Milestones

### M0 — Design the workflow

Sketch onboarding, Today, the weekly calendar, the assignment inbox and import
review, and history and settings. The layout is a calendar with a task sidebar
and a task-detail panel containing the timer. Include mobile layouts, keyboard
operation, loading and error states, and an explicit schedule-approval screen.
Test the clickable prototype with a few students.

**Demonstrates:** the workflow makes sense to a real student before any code
commits to it.

### M1 — First deployed vertical slice

Repository and UI skeleton, Supabase project, initial schema and access
policies, and a deployed frontend, API, and database that are actually talking
to each other. A student signs in, creates a task, and sees it after a reload.

**Demonstrates:** the whole pipe works end to end. Do this before building
features, not after.

### M2 — Task entry and the timer

Task creation and editing, work sessions with start, pause, resume, and finish
persisted so a refresh does not lose the session, and after-the-fact correction
for a forgotten timer. Begin a small consented diary pilot here — real
observations are the scarce resource, and they can only be collected over time.

**Demonstrates:** the system can observe what actually happens.

### M3 — Import and extraction

Document upload to private storage, an import job, PDF text extraction, and an
LLM call with a Pydantic schema producing draft assignments the student
confirms. File limits, retries, timeouts, and deduplication so a retry cannot
create duplicates.

**Demonstrates:** capture without manual entry, which is what makes the product
usable beyond a demo.

### M4 — Estimation and schedule approval

Estimates from the student's own guess, category medians, and smoothed personal
corrections. Constraint-based scheduling around fixed events, deadlines, breaks,
and available hours, returned as a preview that names what could not be
scheduled and why. Confirming saves blocks; dragging edits preferences and
placements; a stale plan is rejected.

**Demonstrates:** the core product loop. Target for the Fall midpoint.

### M5 — Calendar integration

Manual events and ICS import first, then Google Calendar behind its own OAuth
flow, with encrypted refresh tokens, a dedicated planner calendar for exported
blocks, and handling for event IDs, recurrence, time zones, and revocation.
Check Canvas developer-key access early; integrate if authorized.

**Demonstrates:** the schedule reflects the student's real commitments.

### M6 — Feedback capture

Log every prediction with its model version and the features available at
decision time, alongside corrected actual durations and schedule edits. Update
personal corrections as tasks finish. Keep synthetic records distinct from real
observations. Track missing logs and the burden the feedback places on students.

**Demonstrates:** there is a dataset worth training on. Target for the Fall
final, together with M3 and M4.

### M7 — Duration model

Quantile regression over consented records, split chronologically, tuned on
validation data with a reserved test set. Compare against the student's initial
estimate and a category baseline; measure error and calibration; report
per-student results and incomplete-task bias.

**Demonstrates:** the central claim of the project, or an honest negative
result. Spring.

### M8 — Model iteration in production

Training on a schedule, versioned artifacts in private storage, metrics and
dataset versions in Postgres, promotion only after evaluation, and the previous
artifact retained for rollback.

**Demonstrates:** the loop closes without a human running a script.

### M9 — Release and operate the pilot

pytest for timer arithmetic, authorization, scheduling, and retries; Playwright
for the full flow; cross-user access, time-zone change, failed import, and token
expiration tests. Health checks, scrubbed error logs, backups with a verified
restore, data deletion and export, and usage alerts. Repeat user testing and
track planning time and manual rescheduling.

**Demonstrates:** a system a real student can rely on, measured.

## Parallelism

Once the schema and API contracts exist after M1, interface work, import
processing, and scheduling can proceed in parallel. Personalization work depends
on real feedback, so M7 cannot start until M6 has been collecting for a while —
which is why the diary pilot starts at M2 rather than when the model is ready.

## Deliverable mapping

- Fall midpoint: M0–M4, hosted
- Fall final: through M6, with a usable import and feedback loop
- Spring: M7–M9, with a repeated-use study
