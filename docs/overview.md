---
created: 2026-09-20
updated: 2026-09-20
---

# Overview

Purpose: describe the problem this project solves, who it is for, and what is
in and out of scope. Read this before the architecture.

## The problem

Students do not plan badly because they lack a calendar. They plan badly because
they do not know how long their work will take. A problem set budgeted for two
hours takes five; a reading budgeted for an afternoon takes forty minutes. Every
planner on the market accepts the student's own estimate at face value and then
produces a schedule that is wrong from the moment it is created.

The consequence is not a missing feature. It is that the schedule loses
credibility after the first week, and the student abandons it.

## The approach

Close the loop between estimate and outcome:

1. **Capture** assignments, by manual entry or by importing a syllabus or
   assignment page.
2. **Estimate** how long each will take, starting from the student's own guess
   and category baselines.
3. **Schedule** the work into real free time around fixed commitments and
   deadlines, and ask the student to approve the result.
4. **Observe** what actually happened through a lightweight timer and
   after-the-fact corrections.
5. **Learn** from those observations, so the next estimate for this student on
   this kind of task is better than the last.

Step 5 is what distinguishes this from a to-do list with a calendar view.

## Users

The pilot user is a university student with five or six concurrent courses,
recurring assignments with deadlines, and irregular free time. The first study
population is UPenn students, recruited for a consented diary pilot.

Two properties make this population workable: they are reachable for repeated
testing, and their workload is naturally repetitive enough that a per-student
model has something to learn within one semester.

## What success means

Quantitative targets the system should be evaluated against:

- Duration predictions beat both the student's initial estimate and a
  course-category median baseline, measured by absolute error on held-out,
  chronologically later tasks.
- Conservative (80th-percentile) predictions actually cover roughly 80% of
  outcomes — that is, the uncertainty estimate is calibrated, not just lower or
  higher.
- Students spend less time manually rescheduling than they did before.

Per-student results are reported alongside aggregate results. An average that
hides one student for whom the model is useless is not a success.

## In scope

- Assignment capture: manual entry and document import
- Duration estimation with uncertainty
- Constraint-based weekly scheduling with explicit student approval
- Work-session logging and correction
- Calendar integration: manual events, ICS import, then Google Calendar
- Model training, evaluation, and versioned promotion

## Out of scope

- Team or shared planning. Single-student use only.
- A native mobile app. The web app is responsive.
- Reinforcement learning over scheduling actions. Recorded as a possible later
  experiment; the core feedback loop does not depend on it.
- Fine-tuning a language model. Only considered if extraction accuracy proves
  insufficient with prompting and structured outputs.

## Course constraints

This is a UPenn CIS 4000/4100 senior project built by a team of five to six
students across two semesters. The Fall deliverable is a working prototype with
a credible path to the Spring version; the Spring deliverable is the evaluated
system. Course-level detail lives outside this repository in the team's
planning notes.

The practical consequence for the architecture: the work must divide into
independently ownable tracks — interface, backend and data, imports and
integrations, prediction, scheduling, and evaluation and operations.
