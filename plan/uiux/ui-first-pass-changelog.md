# UI first pass: changelog

Status: Proposed. Not reviewed or adopted by the team.

Purpose: the dated history of the UI work on branch `hxu/ui-first-pass`. The current
state, open items, and next step are in the handoff in [active.md](../active.md). This file
records history; it is not a source of truth for logic (see the file map in
[ui-ux.md](ui-ux.md)).

## Starting point

- Product direction and flows: the rewritten goal in [docs/overview.md](../../docs/overview.md)
  and the two flows in [user-flows.md](user-flows.md).
- [prototype/](../../prototype/README.md) is a clickable UI of both flows in plain HTML, CSS,
  and JavaScript (no packages, no build step), following the team's Figma. Scheduling
  rules live in one pure module, [prototype/js/engine.js](../../prototype/js/engine.js), with
  31 tests. The LLM, duration model, accounts, and calendar sync are placeholders.
- [prototype/DESIGN.md](../../prototype/DESIGN.md) records how it was built and how to rebuild
  it, and points to user-flows.md for every rule. Open choices are listed there.

## 2026-10-03

- Checked node by node against the flows artifact; eight mismatches were fixed in the
  prototype. Howard then decided the three gaps found in the flows (no prompts for fixed
  events or classes, missed fixed blocks are only greyed out, slider only for tasks
  without milestones) and added overlap prompts, the Class event type, minute-level
  times, and a new repeat model. The flows page, [user-flows.md](user-flows.md),
  and the prototype were updated together.
- [user-flows.md](user-flows.md) became the source of truth for all UI/UX
  logic (narrowed on 2026-10-04 to scheduling logic; see below), edited directly by the
  team. It includes a rule reference that marks placeholders (re-estimation math,
  preference defaults, the LLM) and prototype limits (28-day "anytime", 8-week
  never-ending repeats). [prototype/DESIGN.md](../../prototype/DESIGN.md) is the source of
  truth for how the prototype was designed and built from those rules.
- Later: added [ui-ux.md](ui-ux.md), then in `docs/` (UI/UX goal, principles, and a map giving
  each UI/UX file one job), linked from the overview. Tasks are now called **fixed** or
  **flexible** everywhere (was "floating"). The shared flows page was retired;
  user-flows.md renders its own diagrams on GitHub. Errands and chores that are not done
  yet can be extended, continued now, or finished later.

## 2026-10-04

- Tasks are now **anchored** or **floating** (was fixed / flexible), in every doc, the
  screen text, and the code (`kind: 'anchored'`, an `anchored` flag instead of `locked`).
  "Lock in place / Unlock" became "Anchor here / Let it float". Added anchor and wave
  graphics. Saved prototype data resets on first load (data version 5).
- user-flows.md now has a reading note and, under each master flowchart, smaller charts
  of its parts (Flow 1: anchored task, class assignment, fill logic; Flow 2: who gets
  asked, assignment feedback, not-an-assignment feedback). The masters stay the source of
  truth; changing a part means checking its master. Fixed in the Flow 2 chart: a
  duplicated node ID had routed "Not yet" into "Student adds milestones". Flow and
  prototype changes: tasks are "class assignment" or "not an assignment" (errands,
  chores, meals, social events, anything else); a task that is not an assignment asks
  "Done?" only after its last session; assignments no longer ask "Got any work done?"
  (0 minutes means none). All eight charts render with no arrow through a box or another
  arrow's label (checked in Chrome).
- At Howard's request, anchored events and classes can be dragged on Weekly Plan, not
  just floating blocks. A repeating one asks "Just this one" or "All events in the
  series" (the same rule as the edit pop-up), then the overlap check runs. Updated
  user-flows.md, prototype README and DESIGN.md. Checked by a scripted Chrome drag of the
  gym (one occurrence) and a class (whole series).
- Howard split the UI/UX sources of truth. user-flows.md owns the logic that decides when
  a task gets scheduled; DESIGN.md owns the supporting UI rules (new "UI rules" under
  section 4, written from an audit of every UI file). Moved out of user-flows.md: pop-up
  dismiss mechanics, form checks, settings granularity, the first-run/Settings location
  of preferences, button wording. Added to user-flows.md (rules the code already
  followed, listed under "Still open" to confirm): the initial-estimate order, closing the
  does-not-fit pop-up keeps preferences, deleting frees time without pulling work
  earlier, and changing preferences does not move scheduled work. Three UI-only oddities
  went to DESIGN.md "Open choices". Docs only; no code changed.
- Howard resolved two of those choices. The Dashboard page title is now "Dashboard" (was
  "Weekly Overview"). On Tasks, every assignment without milestones shows its slider
  progress as a bar, including 0% (before, only tasks that cannot be split did). Checked
  in headless Chrome.
- Howard sharpened the split. user-flows.md states every rule in terms of general inputs
  ("session ended", "student chooses to keep the overlap", "no feedback yet"), never what
  the input looks like; DESIGN.md says what each input looks like in practice. Reworded
  user-flows.md throughout, all eight charts included: pop-ups, the slider, checkboxes,
  dragging, notifications, and form defaults are gone; "greyed out" became "marked
  missed: no longer counts toward the task, kept in the calendar history as a record".
  The "Closing a pop-up" row became "Choices not made". Added to user-flows.md: marking a
  task that is not an assignment done from the to-do list (the code did this; listed
  under "Still open" to confirm). Added DESIGN.md "Input mapping": every input and what
  produces it, plus how missed, flagged, and reported states are shown. Docs only.
- Placement strategy opened as a question. Howard found that a floating session moved
  aside by an overlap is re-placed from scratch (earliest day with room, peak-energy
  hours), not near its old time. Added [question 9](../questions.md) (front-load or spread
  out, possibly a student slider, and re-placing moved work near its old time) and
  [question 10](../questions.md) (which scheduling inputs a student can set per task, with
  general preferences as defaults). The fit-check rule in user-flows.md is now marked
  **Placeholder** and links to both through "Still open". Docs only; no code changed.
- The branch history moved from [active.md](../active.md) to this file; active.md keeps the
  handoff.
- Moved `docs/ui-ux.md`, `plan/specs/user-flows.md`, and this changelog into `plan/uiux/`,
  since all three describe proposed work, not adopted behavior. Links updated.
