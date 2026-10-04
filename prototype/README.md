# Inflow UI prototype

Status: **Proposed.** A throwaway first pass at the web app UI, built on branch
`hxu/ui-first-pass` to make the flows in
[plan/uiux/user-flows.md](../plan/uiux/user-flows.md) (the source of truth for when work gets
scheduled) tangible. The supporting UI rules are in [DESIGN.md](DESIGN.md). It is **not** a stack
or architecture decision (those are still open in [plan/questions.md](../plan/questions.md)).
It is plain HTML, CSS, and JavaScript with no dependencies and no build step, so it does
not commit the team to anything. How it was designed and how to rebuild it:
[DESIGN.md](DESIGN.md).

## Run it

Open [index.html](index.html) in Chrome (double-click, or `open prototype/index.html`).
Nothing to install. State is saved in the browser's localStorage; **Reset** in the
sidebar restores the sample data.

Tests for the scheduling engine (Node 18 or newer, no packages):

```bash
node --test prototype/test/engine.test.js
```

## What is real and what is a placeholder

The scheduling engine, both flows, and the feedback loop are real and tested. The LLM,
duration predictions, backend, and clock are not. The full list, with where each lives
in the code, is in [DESIGN.md section 10](DESIGN.md#10-placeholders-and-prototype-limits);
the rules they stand in for are marked in the rule reference of
[user-flows.md](../plan/uiux/user-flows.md#rule-reference).

## Try the flows

The demo clock starts at 8 AM on a weekday. Seed data: three classes (Class events), a
gym routine and a dentist appointment (anchored events), laundry (weekly on Sat or Sun,
10 AM to 8 PM), and five other floating tasks already scheduled.

**Flow 1: adding a task** (Add task, any page)

1. *Anchored task.* Click an empty slot on **Weekly Plan**, or Add task then **Anchor it: pick a time**.
   Overlap a blue block or the gym: you are asked to move it or keep both. Moving the gym
   opens its edit pop-up (this event or all of them). Overlapping a class asks nothing.
2. *Assignment.* Add task, **Let Inflow schedule it**, **Class assignment**. Paste
   instructions: Inflow shows a placeholder estimate. Milestones are optional:
   **Generate milestones** (numbered lines become milestones), open the assistant, and try
   "break it into smaller steps". Add it.
3. *Does not fit.* Add an assignment with 12 hours due tomorrow. The warning dialog
   offers later work hours and a smaller deadline buffer, for one task, a week, or for
   good, and previews whether it then fits. Or choose **Schedule what fits** (tasks that
   can be split) or **Leave unscheduled** to see the other end states.
4. *Other task.* Choose **Other**, set the earliest and latest time and the minutes. It
   is not splittable by default. Try repeat: weekly on Mon, Wed, Fri between 5 and 9 PM;
   weekly on Sat or Sun ("any one of them"), every 2 weeks; or monthly on the last Friday.
5. *Move and anchor.* Drag a blue block. It is anchored at the new time. Click it and choose **Let it float** to undo.
   Drag the gym or a class too: a repeating event asks whether to move just this one or the whole series.
6. *Work late.* In Settings, set work hours to 10 AM until 3 AM (next day), or all 24
   hours. Sessions can then run past midnight.

**Flow 2: after a session** (Prototype controls in the sidebar)

1. **End next session** ends the next session that gets a prompt and opens the pop-up
   (in real use it appears the next time the student opens the app, plus a browser
   notification if enabled in Settings).
2. Assignment: enter the minutes spent; **0** greys the session out and reschedules it.
   Otherwise, check which milestones are done (or, without milestones, set the slider).
   Finish none to see the "smaller milestones" pop-up. Finish the last one to see "Is the
   whole assignment finished?".
3. A task that is not an assignment asks "Done?" only after its last session. Answer
   **Not yet**, enter the minutes left, and pick **Extend timeslot**, **Continue now**, or
   **Finish later**. Change its usual duration by hand on the Tasks page (this one or all
   upcoming). Anchored events and
   classes never prompt.
4. **+1 day** lets prompts stack up. The X or Esc leaves the stack; **Skip for now**
   skips one. Until answered, the schedule assumes the session happened.
5. **Tasks**, then **Log progress**, reports work done outside a planned session.
