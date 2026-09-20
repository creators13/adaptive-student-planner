---
created: 2026-09-20
updated: 2026-09-20
---

# Testing

Purpose: what to test, with what, and what counts as evidence. Status:
provisional — the tooling below is chosen but not yet installed.

## Tools

| Layer | Tool |
|---|---|
| Backend unit and integration | pytest |
| Frontend unit | Vitest |
| End to end | Playwright |
| Continuous integration | GitHub Actions running `./scripts/check.sh` |

## What must be tested

Some of this system is ordinary CRUD and some of it is easy to get subtly,
silently wrong. Concentrate effort on the second category.

**Timer arithmetic.** Start, pause, resume, and finish transitions; summing
active time across multiple sessions; a page refresh mid-session; a forgotten
timer corrected after the fact. Off-by-one errors here corrupt training labels,
which is worse than a visible bug.

**Authorization.** A user reading, updating, or deleting another user's task,
session, schedule, or upload — through the API and through the worker path. The
worker bypasses row-level security, so its ownership checks need explicit tests,
not trust.

**Scheduling.** Deadlines respected, fixed events not double-booked, breaks
honored, unschedulable work reported rather than silently dropped, and a stale
plan rejected when the underlying tasks or availability changed after the
preview was generated.

**Import and retry.** A failed import retried must not produce duplicate
assignments. Test malformed documents, oversized files, timeouts, and an
extraction result that fails schema validation.

**Time zones.** A student who changes time zones mid-week. Anything that reads
a local date from a UTC timestamp.

**Token lifecycle.** Expired access token, revoked Google Calendar grant.

## Model evaluation is not a unit test

Prediction quality is measured, not asserted. Keep it separate from the test
suite:

- Split chronologically before training. A random split leaks the future and
  produces a number that will not survive contact with a real student.
- Compare against two baselines: the student's own initial estimate, and a
  course-category median.
- Report error and calibration — whether 80th-percentile predictions cover
  roughly 80% of outcomes.
- Report per-student results, not only the aggregate.
- Exclude synthetic records and unfinished tasks from reported accuracy.

## Test data

Synthetic assignments and simulated histories are for exercising screens and
APIs before real data exists. They must be flagged in the database and must
never appear in a reported accuracy figure. Real pilot records are consented
student data — do not copy them into fixtures.

## Evidence

A change is not verified because it looks right. Run `./scripts/check.sh` and
quote the output in the pull request or handoff. If a check was skipped, say
which one and why.
