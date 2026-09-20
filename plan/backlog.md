---
created: 2026-09-20
updated: 2026-09-20
---

# Backlog

## Status

Proposed

Purpose: work that is worth doing but is not scheduled. Nothing here is
committed. Promote an item into [roadmap.md](roadmap.md) or a spec in
[specs/](specs/) when it becomes real.

## Product

- Canvas LMS integration for automatic assignment import, pending developer-key
  access
- Recurring task templates for weekly problem sets and readings
- Notifications or reminders ahead of a scheduled block
- An explanation surface: why this task was placed here, and what would have to
  change to move it

## Technical

- GitHub Actions running `./scripts/check.sh` on every pull request — do this as
  soon as there is code to check
- Structured logging and error tracking
- Seeded synthetic data generator for exercising screens before real data exists
- A held-out evaluation harness that can be re-run on every model candidate

## Research

- Reinforcement learning over scheduling actions, learned from student
  acceptance and rescheduling behavior. A later experiment; the core loop does
  not require it.
- Fine-tuning an extraction model on validated team-authored examples. Justified
  only by a measured accuracy shortfall from prompting with structured outputs.
- Cold-start estimation for a student with no history, borrowing from
  course-level or cohort-level distributions

## Validated negatives

Recorded so they are not reconsidered without new information:

- Team or shared planning. Different product, and it dilutes the per-student
  learning signal that makes this project interesting.
- A native mobile app. The responsive web app is sufficient for the pilot and
  costs a workstream the team does not have.
