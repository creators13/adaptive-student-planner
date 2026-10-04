# Inflow web app: design record

Status: **Proposed**, written 2026-10-03 on branch `hxu/ui-first-pass`; converted to React
and TypeScript on 2026-10-04 (section 2). Audience: a person or agent who needs to change
or rebuild this app, or build a similar one with the same structure and user flows.

**Two documents, two jobs.**

- [plan/uiux/user-flows.md](../plan/uiux/user-flows.md) is the source of truth for the
  logic that decides **when and whether the system schedules a task**: both flowcharts,
  what each input means to the planner, the repeat model, the prompt table, the rule
  lists, and a rule reference with every placeholder and prototype limit marked. It is
  written in terms of general inputs ("a session ends", "the student chooses to keep the
  overlap", "no feedback yet"), never in terms of what an input looks like.
- This document is the source of truth for **what each input looks like in practice**
  (section 4, "Input mapping") and every other on-screen rule (section 4, "UI rules":
  layout, dialog mechanics, form checks, defaults in forms, wording, how results and
  states are shown), and for how the prototype was built: the build process, structure,
  data model, sample data, how each rule became code, and the traps found on the way. It
  does not restate the scheduling rules.

The test for where a rule goes: if it decides when or whether work is scheduled, it
belongs in user-flows.md, phrased as an input and its outcome. How the student produces
that input, and how the outcome is shown, belongs here. Example: "until the student gives
feedback, the session is assumed done" is in user-flows.md; "closing the feedback pop-up
means no feedback yet" is here. A redesign that changes how inputs look should only change
this document. If the two documents disagree about an outcome, user-flows.md wins. [plan/uiux/ui-ux.md](../plan/uiux/ui-ux.md) maps every UI/UX file.

To rebuild: read user-flows.md for *what* the app does, then this document for *how* this
prototype turns it into a working product. [README.md](README.md) says how to run it and walks
through each flow.

## 1. Goal and constraints

**Goal.** A working app that supports every step of both flows in user-flows.md: adding a
task (anchored or floating), and feedback after a session. Priority given by the requester:
full flow coverage first, fidelity to the Figma mockup second. LLM integration,
accounts, and calendar sync were out of scope. It is a first draft to build on, not a
throwaway ([decision 0001](../docs/decisions/0001-frontend-react-typescript.md), proposed).

**Constraints that shaped the build.**

- The first pass ran with no stack chosen, so it was plain HTML, CSS, and JavaScript with
  no packages. Once Howard chose to keep it as a first draft, it was converted to React,
  TypeScript (strict, no `any`), and Vite, in `web/` where `scripts/check.sh` expects the
  frontend. The backend is still undecided ([question 4](../plan/questions.md)).
- AGENTS.md: synthetic data is labeled, predictions are logged with their inputs, time
  on unfinished work is never a duration label, durations are integer minutes,
  timestamps are absolute times.
- The scheduling logic must be testable apart from the UI, because the flows depend on
  it and it is the part most likely to be ported to a real backend.

## 2. How it was designed and built

Follow this order to reproduce it.

1. **Read the sources.** user-flows.md (every box, branch, and rule became a
   requirement) and all 11 frames of the Figma file (section 3).
2. **Decide the shape.** Four screens plus dialogs. Three kinds of thing on the calendar:
   anchored events (event or class), floating sessions, and sessions the student anchored. One pure engine
   module that owns every scheduling and re-estimation rule. A thin DOM layer on top.
3. **Write the engine first, with tests** (now `src/domain/engine.ts` and its test file): the
   fit check, making room, relaxation, reconcile and trim, overlaps and edits,
   re-estimation, prompt rules, repeats, work hours past midnight, tasks that are not
   assignments and not done yet. 31 tests.
4. **Build the UI toolkit** (now `src/ui/`): icons, buttons and fields, the dialog stack,
   toasts. Then the store and sample data (`src/state/`).
5. **Build the flows as async functions** that open dialogs in sequence
   (`src/flows/`). A dialog returns a promise, so each flow reads top to bottom like its
   flowchart.
6. **Build the views** (Weekly Plan, Tasks, Dashboard, Settings) and the app shell.
7. **Verify in a real browser** by scripting Chrome through the DevTools protocol and
   walking every branch of both flows with screenshots and console checks (section 13).
   This found defects that unit tests had not (section 11).
8. **Audit against user-flows.md** node by node, fix mismatches, and send gaps in the
   rules back to the product owner. Repeat whenever the rules change.
9. **Write the docs**: this file, the README, and the rule reference in user-flows.md.
10. **Convert to React and TypeScript** (2026-10-04), keeping behavior identical: port the
    engine and its 31 tests line for line to `src/domain/`, then the store, the dialog
    stack, and each screen, reusing the stylesheet unchanged. Checked three ways: the
    engine tests; screenshots of all four pages that are pixel-identical to the plain-JS
    version (same hashes); and a 25-step browser walkthrough of both flows run against both
    versions, whose output (dialogs, toasts, and the saved schedule after every step) was
    identical. One defect surfaced and was fixed (section 11).
11. **Validate against the flowcharts**: one UI test per path through each master
    flowchart, mapped node by node in
    [plan/uiux/flow-validation.md](../plan/uiux/flow-validation.md). Repeat whenever the
    charts change.

## 3. Inputs

### The rules (user-flows.md)

Primary input. The rules went through several rounds with the product owner (first on the
shared flows page, now in user-flows.md), and the prototype was updated with them each
time.

### Figma file (`senior-design`, page 1)

| Frame | Used as | Changes made |
| --- | --- | --- |
| Weekly Plan screen | **Weekly Plan** | Real 24-hour time axis, week and day views, now-line, work-hours shading, click-to-add, drag-to-move, block states, legend |
| Tasks screen | **Tasks** | Status badges, remaining time and progress, expandable details, Log progress / Mark done, estimate override, a completed section |
| Add task upload flow | **Add task dialog** | A modal instead of a side drawer. "Upload PDF" became one of four instruction inputs. "Confirm and schedule" became "Add task" |
| Post-block feedback | **Feedback dialog** | The flow's questions replaced Yes/Partly/No. Kept: time taken, the "No pressure" note, Skip for now |
| Onboarding work preferences | **First-run dialog** | One step. Added cut-off, buffer, shortest and longest session |
| Settings screen | **Settings** | Work preferences, temporary changes, notifications. Profile and Google Calendar cards not built |
| Notifications | Notification toggles in Settings | Added "Session feedback" and a browser-notification button |
| Weekly Overview screen | **Dashboard** | Stat cards, Today's focus, "Needs your attention" |
| Analytics, Login and sign up, laptop frame | Not built | Outside the flows |

The Figma has no variables or tokens, so colors and sizes were read from screenshots
(section 9).

## 4. Screens and UI rules

### Screens

**Shell.** Left sidebar (hash routes): Dashboard `#/dashboard`, Weekly Plan `#/plan`
(default), Tasks `#/tasks`, Settings `#/settings`. Below them: a **Session feedback**
button with a count of waiting prompts, the **Prototype controls** panel (demo clock;
"End next session", "+1 hour", "+1 day", "Reset"), and a user card. Under 900px the
sidebar becomes a top bar. Every page except Settings has an **Add task** button.

**Weekly Plan.** Header with the week's dates, Week/Day toggle, previous / Today / next,
Add task. A legend, a warning banner listing tasks not fully scheduled (each with
"Fix"), then the calendar: all 24 hours at 52px per hour, scrolled to about 7 AM at
first, hatched bands outside work hours, a red now-line. Blocks that overlap sit side by
side; a block that crosses midnight appears in both days. Clicking an empty slot opens
Add task as an anchored task at that time. Dragging a floating block moves and anchors it;
dragging an anchored event or class changes its time (asking this one or all repeats if it
repeats). Either way the overlap check runs next. Clicking a block opens **Block details**: status chips,
the task it belongs to, and actions that depend on the block (Edit time and Delete for
anchored events; Anchor here / Let it float and Move for sessions; Give feedback when a prompt waits).

**Tasks.** Search, course filter, sort (deadline, name, needs attention). One row per
active task, with repeating tasks collapsed to their next occurrence ("Weekly on Sat or
Sun · 3 more upcoming"). Columns: task (with target finish or window), course, deadline,
remaining time with a progress bar, status badge plus Floating or "N anchored", and actions
(Fix, Log progress for assignments, Mark done for other tasks). Expanding a row shows its
sessions, milestones, the estimate and its source, an override field ("this one" or "all
upcoming" for repeats), and Delete. A collapsible "Completed" table lists predicted vs
actual time for finished assignments.

**Dashboard.** Three stat cards (open tasks, completed, focus time this week), Today's
focus (today's sessions, done ones checked), and "Needs your attention" (waiting
prompts with Answer, tasks not fully scheduled with Fix).

**Settings.** Work preferences (the same form as first run), Save changes, the list of
temporary relaxations with Remove, and notification switches with a button to allow
browser notifications.

**Dialogs**, all on one modal helper: Add task; Does not fit; Overlap (move or keep);
Edit event (this event or all); Delete scope (just this one, this and later ones);
Feedback (assignments, one step: minutes spent, where 0 means no work, then milestones or
the slider; tasks that are not assignments, after their last session: Done?, and if not
yet, minutes left plus Extend timeslot, Continue now, or Finish later); No-progress pop-up;
Last-milestone confirm; Milestone editor with the assistant chat; Block details;
First-run preferences; Confirm.

### Input mapping

Each general input in user-flows.md, and what produces it in this prototype. This table
is where the two documents meet: change a row here to redesign how the student does
something; change user-flows.md to change what it does to the schedule.

| Input in user-flows.md | What produces it in the prototype |
| --- | --- |
| Student picks a time (anchored task) | Add task, then **Anchor it: pick a time**; or clicking an empty calendar slot |
| Student adds a floating task | Add task, then **Let it float: Inflow finds a time** |
| Student gives a task's details | The Add task form (section 4, "Add task") |
| Student moves an event or session to a new time | Dragging the block; **Move** in Block details (sessions); **Edit time** in Block details (anchored events) |
| Student chooses this event or all its repeats | The move-scope pop-up after a drag (**Just this one** / **All events in the series**); "Apply to" in the edit pop-up |
| Student anchors a block in place / lets it float | **Anchor here** / **Let it float** in Block details; **Let it float** on the toast after a drag |
| Student chooses to move the overlapped event | **Move "…"** in the overlap pop-up |
| Student keeps the overlap (or does not choose to move) | **Keep the overlap**, or closing the overlap pop-up with X or Esc |
| Student relaxes a preference, for a chosen time | The does-not-fit pop-up: Work until, deadline buffer, "Apply this change for", then **Apply and schedule** |
| Student keeps their preferences | **Schedule what fits** or **Leave unscheduled**, or closing the does-not-fit pop-up |
| Student overrides an estimate | The override field in Add task; **Override** in an expanded Tasks row |
| Student changes a preference | First-run dialog; Settings, then **Save changes** |
| Student ends a temporary relaxation early | **Remove** under Temporary changes in Settings |
| Student deletes an event (this one or this and later) | **Delete** in Block details, then the delete-scope pop-up for a repeating event |
| Student deletes a task | **Delete task** in an expanded Tasks row, after confirming |
| Student is asked for feedback | A browser notification (if allowed in Settings) and the feedback pop-up when the app is next opened; the **Session feedback** button and **Answer** on the Dashboard open waiting requests |
| No feedback yet | **Skip for now** (that one), closing the feedback pop-up with X or Esc (all waiting ones), or never opening it |
| Student reports minutes spent (0 = none) | The minutes field in the feedback pop-up |
| Student says which milestones are finished | Milestone checkboxes in the feedback pop-up |
| Student reports a percentage done | The progress slider (steps of 5%) in the feedback pop-up |
| Student confirms the whole assignment is finished, or not | **Yes, it's finished** / **Not yet. Add milestones** in the pop-up that must be answered |
| Student breaks milestones into smaller ones, or adds milestones | **Type them in** / **Chat with the assistant** / **Not now**, then the milestone editor |
| Student says a task that is not an assignment is done, or not yet | **Yes** / **Not yet** in the Done? pop-up |
| Student picks extend, continue now, or finish later | **Extend timeslot** / **Continue now** / **Finish later** after entering the minutes |
| Student logs progress outside a session | **Log progress** in a Tasks row (assignments) |
| Student marks a task that is not an assignment done | **Mark done** in a Tasks row |

How states from user-flows.md are shown: a session **marked missed** stays on the calendar
greyed out, dashed and struck through (the legend calls it Skipped); Block details says it is kept as a record; on the
Dashboard it is struck through. A task **flagged** as partly scheduled or unscheduled
gets a status badge on Tasks, a line in the Weekly Plan banner, and an entry under "Needs
your attention", each with **Fix**. A **reported** shortfall or move appears in a toast.

### UI rules

The source of truth for how the prototype presents and collects what user-flows.md
decides. A rule here never changes when or whether work is scheduled; if it would, it
belongs in user-flows.md, phrased as an input.

**Shell and start-up**

- An empty or unknown route opens Weekly Plan. The nav item for the open page is marked
  as current.
- First run opens the preferences dialog, which cannot be closed: **Use defaults** or
  **Save and continue**.
- Waiting feedback prompts open on page load (the "next visit"). In the demo they also
  open as soon as the clock passes a session's end, unless a dialog is already open.
  The **Session feedback** button shows the count, hidden at zero; with nothing waiting
  it says so in a toast.
- Prototype controls start open on screens wider than 900px. **End next session** moves
  the clock to one minute after the next session that will prompt. **Reset** asks for
  confirmation, keeps the first-run answer, and returns to Weekly Plan.
- The user card (Maya Chen) is a placeholder.

**Dialogs**

- One stack, newest on top. Opening a dialog focuses its first field, Tab stays inside
  it, and closing it returns focus to where it was.
- X and Esc close the top dialog, except the two that must be answered: first-run
  preferences and "Is the whole assignment finished?".
- What closing means for the overlap, does-not-fit, and feedback pop-ups is in "Input
  mapping". A feedback pop-up closed with X or Esc leaves the whole stack, while **Skip
  for now** skips only that one. Closing any other dialog cancels it, and nothing changes.
- Feedback prompts are shown oldest first, with "N of M" in the eyebrow.
- Reset and Delete task ask for confirmation. Deleting a repeating event asks its scope
  instead. Deleting a one-time anchored event from Block details asks nothing.
- Form errors: the first failing check is shown as one message under the form, and the
  dialog stays open.

**Toasts**

- Bottom right, at most three at a time (the oldest is dropped). They last 7 seconds, or
  9 for scheduling reports and feedback outcomes, and can be closed.
- Every action that changes the schedule ends with one toast saying what happened:
  scheduled, partly scheduled (with how much is short), could not be scheduled, and which
  tasks were moved to make room. Repeats of one series collapse into one line
  ("(4 times)").
- A toast can carry one action: **View plan** when the report appears off Weekly Plan,
  and **Let it float** after a floating block is dragged.

**Weekly Plan**

- Weeks start on Monday. Day view shows one day.
- Clicking an empty slot opens Add task as an anchored task starting at that slot,
  rounded down to the half hour, one hour long.
- Dragging: any planned block can be dragged (floating and anchored sessions, anchored
  events, classes); done and skipped blocks cannot. A drop snaps to 15 minutes and keeps
  the block's length. A press that moves less than 6px is a click and opens details.
  What a drop does to the schedule is in user-flows.md. Draggable blocks set
  `touch-action: none`, so a touch drag moves the block instead of scrolling.
- Enter or Space on a focused block opens its details.
- The scroll position is kept when the page redraws. The first view scrolls to 7 AM, or to
  an hour before now if that is earlier.
- Overlapping blocks share the column width, side by side.

**Add task**

- From the Add task button: **Let it float**, Class assignment. From an empty slot:
  **Anchor it**, at that time. If the student switches to Anchor it after opening from
  the button, the time starts an hour from now, rounded up to the half hour, and lasts
  an hour.
- Start after and Earliest default to today, with times optional. Course suggests
  courses already in use.
- The anchored form shows live overlap hints as the times change: for classes, "That is
  allowed"; for anything else, "You will be asked whether to move it or keep both".
- "Counts toward an assignment" appears only for type Event and lists active
  assignments. Type Class adds a required Course field.
- Instructions have four tabs: Paste text, Image, PDF, Link. **Generate milestones** is
  disabled until there is something to read. It opens the milestone editor with the
  assistant chat open, and then reads **Regenerate milestones**. **Add milestones myself**
  opens an empty editor with the chat closed.
- The estimate area follows the input: with milestones, "Inflow prediction" shows the
  open milestones' total; with instructions only, the placeholder estimate; with
  neither, Hours and Minutes fields. An optional override (minutes, step 5) appears
  next to a prediction.
- A repeating task that is not an assignment asks Starting / Between / And (a time of
  day) instead of Earliest / Latest.
- Form checks: every task needs a name. Anchored: a date, an end after the start, and a
  course for a class. Assignment: a course, a start, and a complete-by after the start
  if given; every milestone named, and not every milestone marked done unless there is
  an override; without milestones or instructions, a duration. Not an assignment: a
  duration, an earliest day, and a latest time after the earliest; if repeating, a start
  day and a time of day that ends after it starts and, if the task cannot be split, is at
  least as long as the task. A repeat that ends on a date needs the date.

**Repeat editor**

- Does not repeat, Daily, Weekly, Monthly; every 1 to 12.
- Choosing a repeat preselects the first day's weekday. At least one day stays selected.
- "Selected days mean" (all of them, or any one) appears only for tasks that are not
  assignments, with two or more days selected. Monthly adds "Which one in the month",
  with the repeat label as a preview. Assignments get no day picker, with a hint that
  the whole window moves.
- Ends: Never, On a date, or After N times (1 to 60, default 4).

**Milestone editor**

- Rows: title, minutes (at least 5, step 5), remove. When adding an assignment, each
  row also has an "already done" checkbox.
- The add row defaults to 30 minutes; Enter adds.
- A total line shows open milestones, time remaining, and how many are done.
- The assistant chat is a collapsible panel. It greets the student, says it is a
  placeholder, and offers three suggestion chips.
- Saving a milestone dialog needs at least one milestone, each one named.

**Feedback dialogs**

- Assignment session: minutes default to the planned length, and 0 is allowed. Log
  progress: minutes default to 30, at least 1, with **Cancel** instead of Skip for now.
- The checklist shows open milestones with their estimates. The slider moves in steps
  of 5%.
- Session prompts carry the "No pressure" note.
- Not an assignment: "Done?" with **Yes** or **Not yet**. Not yet asks for minutes
  (default 30, step 5), with **Back**, **Finish later**, **Continue now**, and **Extend
  timeslot** (primary).
- No milestone finished: **Not now**, **Type them in**, or **Chat with the assistant**.
- Outcome toasts name the result: greyed out and rescheduled to the new times; complete,
  with predicted vs actual time; ahead; on track; behind, with the time added.

**Does not fit**

- Work until: the current end, then each later hour up to "All 24 hours", with "(next
  day)" marked. Buffer (only for assignments that have one): the current buffer down to
  "No buffer". How long: just this task (default), this week, the next two weeks, or
  until changed in Settings.
- **Apply and schedule** is disabled until a setting changes. The live preview says
  whether it fits, or how much is still short.
- The other button reads **Schedule what fits (time)** when the task can be split and some
  of it fits, otherwise **Leave unscheduled**.

**Tasks**

- Status badge: Unscheduled, Partly scheduled, In progress (time logged or a milestone
  done), otherwise Scheduled. Pill: "N anchored" if any planned session is anchored,
  otherwise Floating.
- Under the title: assignments show "Target finish" (the deadline minus the buffer);
  other tasks show their window and time of day. The Deadline column says "Anytime"
  when there is none.
- Remaining shows the time left, with a progress bar: milestones done, or for an
  assignment without milestones the slider value (an empty bar at 0%). Tasks that are
  not assignments show "of" the total instead.
- Search matches title and course. Sort by deadline (default), name, or needs attention.
  Filter by course.
- Actions: **Fix** (partly or not scheduled), **Log progress** (assignments), **Mark
  done** (other tasks). Expanded: an override field prefilled with the minutes left,
  "This one" or "All upcoming" for repeats, and **Delete task**.
- Completed table, newest first. The difference badge is green within 10 minutes, amber
  when it took longer, blue when shorter. Seeded rows say "(sample)".
- Empty states: "No tasks yet. Add one and Inflow will schedule it." and "No tasks
  match."

**Dashboard**

- Page title "Dashboard", matching the nav, with the dates of the Monday-to-Sunday week.
- Stats: open tasks (and how many are not fully scheduled), completed (all time, and
  this week), focus time (actual minutes of sessions done this week).
- Today's focus lists today's sessions in time order, done ones checked and skipped ones
  struck through.
- Needs your attention: waiting prompts oldest first (**Answer**), then tasks not fully
  scheduled (**Fix**). Empty: "All caught up."

**Settings and first run**

- One preferences form. Available from: any hour. No work after: each later hour, up to
  "Same time next day (all 24 hours)". Moving the start keeps the length of the day.
- Choices: preferred session 25, 30, 45, 50, 60, or 90 minutes; shortest 15, 20, 30, or
  45; longest 60, 90, 120, or 180; break 0 to 20 in steps of 5; buffer 0 to 3 days; peak
  energy morning, afternoon, or evening. A shortest session above the preferred one is
  lowered to match, and a longest below it is raised.
- **Save changes** confirms with a toast that new preferences apply from now on.
- Temporary changes list what was relaxed and until when, each with **Remove**.
- Notifications: the Session feedback switch; the browser-permission state (Enable, On,
  Blocked, or Not supported); four placeholder switches.

**Formats and accessibility**

- Durations "1h 30m", "45m"; times "9 AM", "8:30 PM"; days "Tue, Oct 6".
- Every control has a label and every dialog a title. Overlap hints, the does-not-fit
  preview, the chat, and the demo clock are live regions; toasts are status messages.
  Reduced motion turns off transitions. Keyboard users move blocks with Move or Edit time.

## 5. Architecture

```text
web/
  index.html                 the page; loads src/main.tsx
  package.json               scripts: dev, build, test, lint, typecheck (used by scripts/check.sh)
  src/
    main.tsx                 boot: load state, render <App>
    App.tsx                  shell, hash routing, feedback badge, demo controls, first-run
    styles.css               one stylesheet; CSS variables for the Figma palette
    domain/                  pure TypeScript, no React                       <- tested
      types.ts               the data model (section 6)
      util.ts                dates and formatting
      engine.ts              scheduling and re-estimation
      repeat.ts              repeat rules as forms hold them, labels, conversion
      assistant.ts           placeholder LLM: generate(), estimate(), reply()
      engine.test.ts         31 engine tests
    state/
      store.ts               state, commit/subscribe, persistence, demo clock; useAppState()
      seed.ts                sample data
    ui/                      Icon, Button, Field, dialog stack (openDialog, Modal), toasts
    components/              MilestoneEditor, RepeatEditor, PrefsForm
    flows/
      schedule.tsx           fit check + does-not-fit dialog; overlap prompt + edit pop-up
      addTask.tsx            Add task dialog and what it creates
      addTaskForm.ts         the form's data and checks (testable without a browser)
      feedback.tsx           after-session feedback, log progress, mark done
      validation/            flowchart tests, one per path (plan/uiux/flow-validation.md)
    views/                   PlanView, TasksView, DashboardView, SettingsView (+ onboarding)
    test/                    test setup and helpers (a fixed demo clock and small states)
```

- **Two layers.** `src/domain/` is plain TypeScript with no React, so the scheduling rules
  can be tested alone and moved to a backend later. Everything else is the React app.
- **State flow.** One JSON object in `src/state/store.ts`. `store.commit(fn)` runs a
  mutation in place, saves to localStorage, and bumps a version counter; components read
  state with `useAppState()` and re-render after every commit. `store.preview(fn)` runs
  code on a clone, which powers the live "does it fit" preview. Objects are changed in
  place, so code that holds a block or task sees later changes to it.
- **Flows are async functions.** `openDialog(render)` (in `src/ui/dialog.tsx`) pushes a
  dialog onto one stack and returns a promise of the student's choice. `await
  settle(taskIds)` runs the fit check and awaits the relax dialog when needed;
  `resolveOverlaps(blockIds)` walks each overlap the student created. Closing a dialog
  with X or Esc resolves `DISMISSED`, so a flow can tell "skip this one" from "leave the
  whole stack". Dialog contents are ordinary React components.
- **No HTML from user text.** React escapes text. The only raw markup is the icon paths in
  `src/ui/Icon.tsx`, which are constants.
- **No router or state library.** Four hash routes and one store did not need them; add
  them when the app grows past that.

## 6. Data model

```text
state = { v, now, onboarded, user, prefs, overrides[], notifications,
          tasks[], blocks[], pending[], completed[] }
```

- `now`: the **demo clock** (ms). Starts 8 AM on the next weekday. Moved only by the
  Prototype controls.
- `prefs`: `workStart, workEnd, sessionMin, minSession, maxSession, breakMin, energy,
  bufferDays`. A `workEnd` at or before `workStart` is the next day; equal means 24 hours.
- `overrides[]`: temporary relaxations `{scope: task|week|fortnight, workEnd?, bufferDays?,
  taskId?, until}`. Scope "always" edits `prefs` directly.
- **Task** (floating work; the to-do list): `{id, type: assignment|other, title, course,
  startAfter, completeBy|null, canSplit, rule, seriesId, dayWindow {from,to}|null,
  allowedDays[]|null, needMin, totalMin, predictedMin, loggedMin, pace, progressPct,
  milestones[{id,title,estMin,done}], status: active|complete, sched:
  scheduled|partial|unscheduled|none, shortfallMin, instructions, prediction {model,
  source: milestones|llm-placeholder|student, minutes, features}, predictionLog[],
  sample}`. A repeating task is one task per occurrence sharing a `seriesId`.
- **Block** (anything on the calendar): `{id, kind: anchored|session, eventType: event|class
  (anchored only), course, title, start, end, taskId?, state: planned|done|skipped, anchored,
  seriesId, rule, actualMin}`. An **anchored session** is the student's own time for a task
  (dragged there, or set aside for an assignment) and counts as anchored.
- **Repeat rule**: `{freq: none|daily|weekly|monthly, every, days[0-6], mode: all|any,
  nth: 1-5 or -1 (last), ends: {type: never|on|after, date, count}}`.
- `pending[]`: `{blockId, endedAt}` waiting feedback prompts. `completed[]`: training
  examples `{predictedMin, actualMin, ...}`, finished assignments only.
- Durations are integer minutes; times are absolute milliseconds, with day boundaries from
  the local clock. Every seeded record has `sample: true`.
- The TypeScript types for all of the above are in `src/domain/types.ts`. Saved data lives
  under the localStorage key `inflow-web` with `v: 5`; anything else is replaced by fresh
  sample data.

**Invariant.** For an active task, `needMin` should equal the minutes of its planned
sessions (including ones that ended and await feedback) that start before its due date.
`E.reconcile` restores it: place what is missing through the fit check, or trim surplus.

## 7. Implementing the rules

Each rule area in user-flows.md and the code that implements it.

| Rule area (user-flows.md) | Code | Implementation notes |
| --- | --- | --- |
| Fit check, spreading, energy, breaks | `placeChunks`, `slotsFor`, `nextLen` | Splitting happens *inside* the fit check: a pass means the sessions exist. Busy time is every block, with sessions padded by the break |
| Work hours past midnight | `E.spanMin`, `E.windowOn` | Day iteration starts one day early, because yesterday's hours can run into today |
| Deadline, anytime | `E.deadlineFor`, `E.horizonEnd` | `HORIZON_DAYS` is the prototype limit |
| Making room | `tryBump` | Tries the least urgent task alone, then two, and so on. Re-placed sessions are compared with the old ones; unchanged tasks are left untouched |
| Outcomes | `E.apply` | `nofit` changes nothing; `allowPartial` commits partial or unscheduled |
| Relaxing | `E.addOverride`, `E.prefsFor`, `E.previewFit` | "Later" cut-off is measured from the work start, so 2 AM beats 11 PM |
| Overlaps, edits, delete | `E.overlapsOf`, `E.unplaceSession`, `E.editBlockTime`; `resolveOverlaps`, `editBlock` (`flows/schedule.tsx`) | Each overlapped block is asked about once per action. The planner never creates overlaps itself |
| Dragging blocks | `BlockEl` (pointer handlers), `moveTo`, `moveScope` in `views/PlanView.tsx` | A floating session becomes anchored where it lands. An anchored event or class goes through `E.editBlockTime`, the same path as Edit time; a repeating one first asks `moveScope`, and Cancel leaves it in place. Every drop then runs `resolveOverlaps`. Drag mechanics are in section 4, "UI rules" |
| Prompts | `E.promptKind`, `E.queuePrompts` | Queued when the demo clock passes a session's end; the badge counts `pending`. A task that is not an assignment is only asked about when no later session of it is planned |
| Missed assignment session (0 minutes) | `E.skipBlock` then `E.reconcile` | The block stays as `skipped`; reconcile places the missing minutes as new floating sessions |
| Not an assignment, not done yet | `E.notDoneYet` then `resolveOverlaps` and `E.reconcile` | The remaining minutes become the task's `needMin`. Extend grows and anchors the same block (it is queued again if its new end has passed); continue adds an anchored block at now; later leaves it to the fit check |
| Re-estimation | `E.applyProgress` | Placeholder math, marked in code |
| Completion, training examples | `E.completeTask` | Assignments only |
| Overrides, prediction log | `E.overrideEstimate`, `E.logPrediction` | With milestones, an override rescales pace so it survives later updates |
| Repeats | `E.expandRepeat`, `E.repeatShifts` | Other tasks: one task per occurrence ("any one of" gets `allowedDays`); anchored events: one block per occurrence; assignments: shifted windows |
| LLM | `generate` / `estimate` / `reply` in `domain/assistant.ts` | Keyword rules; the whole contract a real model would replace |

### Flow to code

| Flow step | Where it lives |
| --- | --- |
| Add a task; pick a time or not | Add task button, empty calendar slot; `addTask` (`flows/addTask.tsx`) |
| Anchored: event or class, times, repeat, counts toward an assignment | `anchoredSection`, `RepeatEditor` |
| Drag a block to a new time (this one or all repeats) | `blockEl`, `moveTo`, `moveScope` |
| Overlap: move or keep; edit pop-up; floating re-placed | `resolveOverlaps`, `editBlock`, `E.unplaceSession` |
| Assignment fields, instructions, milestones (optional), estimate, override | `floatingSection`, `instructions()`, `MilestoneEditor`, `estimateBox`; checks in `collect` (`flows/addTaskForm.ts`) |
| Other: earliest, latest, duration, repeat with time of day | `floatingSection` |
| Fit check, making room, does not fit, relax | `settle` → `ensureScheduled` → `E.reconcile`; `doesntFitDialog` (`flows/schedule.tsx`) |
| Scheduled / partial / unscheduled | Task status badge; Weekly Plan banner with Fix; toast |
| Session ends: notification, pop-up, stacking | `store.advance` + `E.queuePrompts`, `notify` (`App.tsx`), `openPending` (`flows/feedback.tsx`) |
| Not an assignment: Done? Not yet: minutes, then extend / continue / later | `doneFeedback`, `DoneStep` |
| Assignment: minutes spent (0 = none), then milestones or slider | `assignmentFeedback`, `ProgressStep` |
| No progress, last milestone, add milestones | `processProgress`, `choicePopup`, `milestoneModal` |
| Ahead / on track / behind | `E.applyProgress` then `settle` |
| Log progress outside a session | Tasks page, `logProgress` |

## 8. Sample data

Seeded by `src/state/seed.ts`, every record flagged `sample: true`, relative to the demo clock
(8 AM on a weekday):

- **Classes** (Class events, five weeks): CS 220 Lecture Mon/Wed/Fri 9:00–10:15,
  MATH 241 Lecture Tue/Thu 10:30–11:45, BIO 201 Lab Wed 1–3 PM.
- **Anchored events**: Gym Mon/Wed/Fri 5:30–6:30 PM (repeating), Dentist appointment in 3
  days, 4–5 PM.
- **Assignments**: Graph Algorithms Problem Set (CS 220, due in 3 days, four milestones,
  210 min), Cell Respiration Lab Report (BIO 201, due in 5 days, four milestones, 210
  min), Titration Lab Experiment (BIO 201, due in 4 days, cannot be split, two
  milestones, 120 min), Midterm Review (MATH 241, due in 6 days, no milestones, 240 min).
- **Other**: Laundry (weekly on Sat or Sun, 10 AM–8 PM, 60 min, four weeks), Pick up
  package (within 3 days, 30 min).

All floating work is placed by the engine at load, most urgent first.

## 9. Visual design

Taken from the Figma: Inter (400 to 700), a blue accent, white cards on a slate tint, a
240px sidebar, 8 to 10px radii. Tokens are CSS variables at the top of `styles.css`:
`--accent #2563eb`, `--accent-soft #eff6ff`, `--ink #0f172a`, `--muted #64748b`,
`--line #e2e8f0`, `--tint #f1f5f9`, plus ok/warn/bad pairs.

**Anchor and float.** The two kinds of task carry their own graphics: an anchor icon on
everything anchored (events, and blocks the student anchored), a waves icon for floating
work, and a soft wave along the bottom edge of floating blocks (hidden on blocks shorter
than 40px, where it would cross the text). The Add task choice reads "Anchor it: pick a
time" and "Let it float: Inflow finds a time"; the block actions are "Anchor here" and
"Let it float".

Calendar encoding: **solid blue with a wave edge** = floating; **blue outline with an anchor** = anchored by the student;
**grey card** = anchored event; **grey with a dark left edge** = class; **green** = done;
**greyed, dashed, struck through** = marked missed (kept as a record); **amber dashed outline with "?"** = feedback
waiting; hatched bands = outside work hours; red line = now.

Responsive to phone width (sidebar becomes a top bar, task rows stack, the calendar
scrolls sideways). Light theme only, matching the Figma.

## 10. Placeholders and prototype limits

Also marked in user-flows.md and in code comments.

| Item | Kind | Where |
| --- | --- | --- |
| LLM milestones, estimate from instructions, chat | Placeholder | `src/domain/assistant.ts` |
| Duration prediction (no trained model; milestone sums scaled by pace) | Placeholder | `E.applyProgress`, `prediction.model = placeholder-v0` |
| Re-estimation math (pace blend, 0.5–2 clamp, 10% / 10 min tolerance) | Placeholder, team to refine | `E.applyProgress` |
| Preferences collected and their defaults | Placeholder, team to refine | `E.DEFAULT_PREFS`, `PrefsForm` |
| "Anytime" capped at 28 days | Prototype limit, to remove | `HORIZON_DAYS` in `engine.ts` |
| Never-ending repeats created 8 weeks ahead | Prototype limit, to remove | `GEN_WEEKS` in `engine.ts` |
| Demo clock and "End next session" | Prototype only | `App.tsx`, `store.advance` |
| Uploaded files and links not read | Prototype only | `instructions()` in `flows/addTask.tsx` |
| Notifications other than session feedback | Prototype only | Settings switches do nothing |
| Storage in localStorage, no accounts or backend | Prototype only | `src/state/store.ts` |

## 11. Defects found by driving the real browser

Recorded because each is a trap for a rebuild.

- A CSS class named `lg` (legend chip) collided with the dialog size class `lg`, so large
  dialogs inherited chip centering. Prefix component classes.
- Making room moved every less urgent task. It now moves the fewest and only reports
  tasks that actually changed.
- A repeating anchored block linked to an assignment counted occurrences after the due
  date, which emptied the assignment's floating plan. Coverage now stops at the due date.
- Closing a feedback dialog advanced to the next of N prompts. X and Esc now leave the
  stack; "Skip for now" skips one.
- Closing the "is the whole assignment finished?" pop-up silently completed the
  assignment. It can no longer be dismissed.
- Toast text named the earliest session instead of the one just added; toasts covered
  dialog buttons and page headers.
- Seeding the demo clock on a weekend piled the week into two days.
- A repeat starting beyond the 28-day horizon could never fit and raised a false "does
  not fit" warning. Work with its own deadline is no longer capped.
- The 8-week cap for never-ending repeats also cut "after N times" short. Only "never"
  is capped now.
- Renaming "fixed" to "anchored" with a find-and-replace also rewrote the CSS keyword
  `position: fixed`, so dialogs and toasts stopped floating over the page. Exclude
  language keywords from vocabulary renames, and check dialogs after any CSS change.
- In the Flow 2 chart, two different boxes shared the Mermaid ID `more`, so Mermaid merged
  them and "Not yet" for a non-assignment task pointed at "Student adds milestones". Give
  every box in a chart a unique ID.
- Found while converting to React: when work hours ended exactly at midnight (9 AM to
  12 AM), Weekly Plan shaded the whole day as "outside work hours", because the end wrapped
  to 0. Fixed, with a test (`views/PlanView.test.tsx`).
- Traps in the React version: React runs effects twice in development, so the first-run
  and "next visit" pop-ups are guarded to open once per page load (`booted` in
  `App.tsx`); and because the store changes objects in place, a test or flow that keeps a
  block must copy any value it wants to compare later.

## 12. Open choices

user-flows.md lists what is still open, including defaults chosen while building this
prototype (a task's own time of day replaces work hours; "any one of" is for floating
tasks only; "all repeats" edits skip past occurrences; one overlap question per
overlapped event; no yearly repeats). Implementation-only
guesses not on the page, and open UI-only choices (they belong here, not in
user-flows.md):

- **Spreading** is earliest-first. A "just in time" or "front-load" rule is equally
  plausible ([question 9](../plan/questions.md)).
- **Tiny sessions.** A remainder as short as 5 minutes can become its own session when it
  fits nowhere else; a hard minimum may be better.
- **Confirmations.** Delete task and Reset ask first, but deleting a one-time anchored
  event from Block details does not.

## 13. Verification

`./scripts/check.sh` runs lint, typecheck, all tests, and a production build of `web/`.
As of 2026-10-04: 74 tests pass, lint and typecheck are clean, and the build succeeds.

- **Engine** (`src/domain/engine.test.ts`, 31 tests): placement, spreading, cannot-split,
  overlaps and explicit moves, silent class overlaps, editing repeats, anchoring, relaxing
  and expiry, partial, minimal bumping, skip and reschedule, ahead/behind/no progress, the
  slider, completion, prompt rules and queueing, repeats (all/any, every N, Nth and last
  weekday, endings, future occurrences), time-of-day windows, allowed days, minute-level
  earliest times, work hours past midnight and over 24 hours, tasks that are not
  assignments and not done yet (extend, continue now, finish later; asked only after the
  last session), assignment-only training examples, the prediction log, and overrides.
- **Flowcharts** (`src/flows/validation/`, 40 tests): every node and branch of both master
  flowcharts in user-flows.md, driven through the UI the way a student would (clicking,
  typing, ending sessions with the demo clock). The node-by-node table is
  [plan/uiux/flow-validation.md](../plan/uiux/flow-validation.md). To check that these
  tests can fail, four rules were broken on purpose (classes prompt, every errand session
  prompts, 0 minutes ignored, never make room); each was caught.
- **Weekly Plan shading** (`src/views/PlanView.test.tsx`, 3 tests).
- **Browser, during the React conversion** (2026-10-04, headless Chrome through the
  DevTools protocol, scripts not committed): all four pages pixel-identical to the
  plain-JS version; a 25-step walkthrough of both flows (anchored tasks and every overlap
  answer, assignments with and without instructions and milestones and the chat, form
  errors, does not fit with relax, repeats, dragging floating blocks and a class series,
  details, delete, every feedback branch, log progress, mark done, override, delete task,
  Settings) gave identical dialogs, toasts, and saved schedules in both versions, with no
  console errors.
- **Browser, plain-JS version** (2026-10-03, before the conversion): the same kind of
  scripted walkthroughs, plus phone width and work hours 10 AM–3 AM. Dragging anchored
  events: the gym with "Just this one" (only that occurrence moved), a class with "All
  events in the series" (all 15 future repeats moved by the same hour), and a plain click
  still opening details.
- All eight charts in user-flows.md (two masters, six parts) were rendered with Mermaid in
  Chrome and checked by script: no arrow passes through a box or another arrow's label.
  GitHub uses its own Mermaid version, so its layout can differ slightly.
- Not verified: Safari and Firefox, keyboard-only drag (blocks open details with Enter,
  and "Move" or "Edit time" is the keyboard path), screen readers beyond labels and roles,
  and real notification delivery.
