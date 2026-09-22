# Proposed testing concerns

Status: Proposed

Purpose: preserve useful correctness and evaluation questions without choosing
features, services, testing tools, or model metrics. Apply each concern only if
it is relevant to the scope students approve.

## Correctness checklist

- **Access control:** Verify that one student cannot access another student's
  records, including through any privileged background operations.
- **Time logging:** If work sessions are included, check pause/resume arithmetic,
  multiple sessions, refresh recovery, and corrections after forgotten timers.
- **Scheduling:** If scheduling is included, check agreed constraints, conflicting
  events, impossible requests, and changes made between preview and approval.
- **Imports and retries:** If imports are included, check duplicate prevention,
  malformed inputs, interrupted operations, and visible failure reporting.
- **Time zones:** Check date boundaries and timezone changes wherever local time
  affects behavior.
- **External access:** If integrations are included, test expired or revoked
  access and make failures visible to the student.

## Evaluation and data integrity

- Select evaluation questions, baselines, and metrics after defining the product
  claim; model quality needs measured evidence beyond passing software tests.
- Keep information unavailable at prediction time out of training features and
  evaluation inputs. Choose a split that matches the intended real use.
- Distinguish unfinished work from completed-duration labels.
- Keep synthetic data labeled and separate from reported real-world accuracy.
- Use consented data appropriately; do not put real student records in fixtures.
- Check whether aggregate results conceal poor outcomes for individual students.

## Verification evidence

Record the commands run, results, and any skipped checks in the PR or handoff.
The existing script entry points are described in the
[README](../README.md#verification-today); their current no-op results are not
application test evidence. Tool selection remains an [open question](questions.md).
