---
created: 2026-10-03
updated: 2026-10-03
---

# MVP user flows

## Status

Proposed by Howard Xu on branch `hxu/ui-first-pass`. Not yet reviewed or
adopted by the team. Builds on the Vision section of the
[overview](../../docs/overview.md#vision).

Purpose: describe how a student interacts with the MVP when adding a task and
after a work session ends. Flow 1 ends with the task scheduled, partially
scheduled, or unscheduled. Flow 2 collects feedback for personal duration
estimates and adjusts the remaining schedule.

## Two kinds of task

- **Fixed:** the student gave it a time, the same way they would add an event in
  Google Calendar. The planner never moves it.
- **Floating:** the student added it to the to-do list without a time. The
  planner places it in free time before the deadline.

Students never label tasks. Giving a task a time is what makes it fixed. Dragging
a floating task to a new time also makes it fixed, and the student can unlock it
to let it float again.

## Flow 1: adding a task

```mermaid
flowchart TD
  start(["Student needs to add a task"])
  start --> pick{"Does the student <br/> pick a time?"}

  pick -- "Yes: fixed task" --> f1["Select a slot in the calendar <br/> and fill in details, including repeat <br/> (overlapping other fixed tasks is allowed)"]
  f1 --> f2{"Does it overlap a <br/> floating task?"}
  f2 -- "No" --> done(["Scheduled"])
  f2 -- "Yes" --> f3["Fixed task keeps the slot, <br/> the floating task is displaced"]
  f3 --> done

  pick -- "No: floating task" --> todo["Add to the to-do list"]
  todo --> type{"Task type?"}

  type -- "Class assignment" --> a1["Fill in course, start after (default today), <br/> complete by (default anytime), repeat, <br/> can split into sessions (default yes)"]
  a1 --> a2{"Instructions provided? <br/> text, image, PDF, or link"}
  a2 -- "Yes" --> a3["LLM proposes milestones and estimates <br/> time for each. Student refines them <br/> by chatting with the LLM"]
  a3 --> a4["Student marks milestones <br/> already completed"]
  a4 --> a5["System estimates remaining time, <br/> and the student can override it"]
  a2 -- "No" --> a6["Student enters the duration. <br/> Milestones are optional: type them <br/> or work them out with the LLM"]

  type -- "Other" --> o1["Fill in window start and end, <br/> duration, repeat, <br/> can split into sessions (default no)"]

  a5 --> fit
  a6 --> fit
  o1 --> fit

  fit{"Can it fit in free time before the deadline, <br/> within preferences, without moving <br/> already scheduled tasks? <br/> (splits into sessions if allowed, <br/> otherwise needs one block)"}
  prefs[/"Preferences: work hours, deadline buffer, <br/> cut-off times (from onboarding or defaults)"/] -.-> fit
  f3 -. "displaced task is re-placed" .-> fit

  fit -- "Yes" --> done
  fit -- "No" --> bump{"Fits if less urgent <br/> floating tasks move?"}
  bump -- "Yes" --> move["Move less urgent floating tasks"]
  move --> done
  move -. "moved tasks are re-placed" .-> fit
  bump -- "No" --> warn["Tell the student it does not fit. <br/> Offer: extend work hours or reduce buffer, <br/> and choose how long the change lasts"]
  warn --> relax{"Student relaxes <br/> preferences?"}
  relax -- "Yes" --> fit
  relax -- "No" --> part{"Can the task be split, <br/> and does part of it fit?"}
  part -- "Yes" --> partial(["Partially scheduled <br/> shortfall shown"])
  part -- "No" --> none(["Unscheduled <br/> stays on the to-do list with a warning"])
```

Every path ends in one of three end states. A task that cannot be split is either
scheduled as one block or unscheduled; only splittable tasks can be partially
scheduled. The fit check decides the session split and the placement together, so
a task that passes already has its sessions. Dashed arrows show tasks re-entering
the fit check: a floating task displaced by a new fixed task, and less urgent
tasks moved to make room.

### What the student fills in

| Class assignment | Notes |
| --- | --- |
| Course | Required |
| Start after | Defaults to today |
| Complete by | Defaults to anytime |
| Instructions | Optional: pasted text, image, PDF, or link. Without them, the student enters a duration. |
| Milestones | Proposed by the LLM and refined by chatting with it, or typed in by the student |
| Completed milestones | Checked off from the milestone list |
| Repeat | Optional |
| Can split into sessions | Defaults to yes |

| Other task | Notes |
| --- | --- |
| Window start | Earliest day it can be done |
| Window end | Latest day it can be done |
| Duration | Entered by the student, in minutes |
| Repeat | Optional; works for fixed and floating tasks |
| Can split into sessions | Defaults to no, for errands or lab work done in one go |

### Example

A student pastes the prompt for a 1,500-word essay due Friday. The LLM proposes
four milestones (outline, draft, revise, citations) and estimates 270 minutes in
total. The student marks the outline as done, so 210 minutes remain. Because the
essay can be split, the fit check divides the time into sessions while placing
them in free time, outside the student's 10 PM cut-off and ahead of a one-day
buffer: Mon 2:00–3:30 PM (draft), Tue 7:00–8:00 PM (revise), Wed
11:00–11:30 AM (citations).

### Rules flow 1 depends on

1. The planner schedules without asking for approval. The student can view and
   adjust the schedule at any time.
2. Once a task is placed, the planner tries not to move it. It moves less urgent
   floating tasks only when a task would otherwise miss its deadline.
3. Fixed tasks may overlap each other. A fixed task always wins over a floating
   task in the same slot.
4. The student can override any time estimate.
5. When the student relaxes a preference to fit work in, they choose how long the
   change applies.
6. The student chooses whether a task can be split into sessions. A task that
   cannot be split needs one free block long enough for the whole task.
7. Milestones exist so the student can report progress, which lets the system
   re-estimate the remaining time. Tasks that cannot be split still get
   milestones.

## Flow 2: after a session

```mermaid
flowchart TD
  ended(["A session ends"])
  log(["Student made progress outside <br/> a planned session and logs it <br/> from the to-do list"])

  ended --> kind{"What kind of task?"}
  kind -- "One-time event, <br/> not schoolwork, fixed" --> quiet(["No prompt"])
  kind -- "Anything else" --> ask["Browser notification, plus a pop-up <br/> on the next visit. Unanswered prompts <br/> stack up. Until answered, the <br/> schedule assumes the session was done"]

  ask --> which{"Task type?"}

  which -- "One-time errand" --> e1{"Done?"}
  e1 -- "Yes" --> logged(["Marked done"])
  e1 -- "No" --> skip

  which -- "Recurring, not schoolwork" --> r1{"Done?"}
  r1 -- "Yes" --> r2["Student enters time spent <br/> (default: session length)"]
  r2 --> r3["Time feeds future estimates <br/> for this recurring task"]
  r3 --> logged
  r1 -- "No" --> skip

  which -- "Assignment" --> s1{"Got any work done?"}
  s1 -- "No" --> skip["Grey out the session and keep it <br/> as a skipped record"]
  skip --> refit

  s1 -- "Yes" --> s2["Student enters time spent <br/> (default: session length)"]
  log --> s2
  s2 --> hasms{"Does the assignment <br/> have milestones?"}

  hasms -- "No" --> nm{"Is the assignment finished?"}
  nm -- "Yes" --> complete
  nm -- "No" --> reest

  hasms -- "Yes" --> s3["Student checks off finished milestones. <br/> Tasks that cannot be split also <br/> get a progress slider"]
  s3 --> prog{"Any progress?"}
  prog -- "Yes" --> last{"Was the last <br/> milestone checked?"}
  prog -- "No" --> small["Assume no progress. <br/> Pop-up offers smaller <br/> milestones: type them <br/> or chat with the LLM"]
  small --> reest
  last -- "No" --> reest
  last -- "Yes" --> confirm{"Pop-up: is the whole <br/> assignment finished?"}
  confirm -- "Yes" --> complete(["Assignment complete. <br/> Remaining sessions removed. <br/> Total time becomes a training example"])
  confirm -- "No" --> more["Student adds milestones: <br/> type them or chat with the LLM"]
  more --> reest

  reest["Re-estimate the remaining time <br/> from progress and pace so far"]
  reest --> pace{"Compared with <br/> the prediction?"}
  pace -- "Ahead" --> trim["Shorten or remove later sessions. <br/> Freed time is not given to other tasks"]
  trim --> updated(["Schedule updated"])
  pace -- "On track" --> updated
  pace -- "Behind" --> refit
  refit(["Remaining work goes back <br/> to the fit check in flow 1"])
```

Flow 2 starts when a session ends, or when the student logs progress they made
outside a planned session from the to-do list. Missed sessions and work that
falls behind go back to flow 1's fit check, so they can end in the same "does not
fit" warning as a new task.

### Who gets which questions

| Task | Prompt | Asks |
| --- | --- | --- |
| Assignment, fixed or floating | Yes | Any work done, time spent, milestones (or slider if it can't be split) |
| Recurring task, not schoolwork | Yes | Done, time spent |
| One-time errand, floating | Yes | Done only |
| One-time event, not schoolwork, fixed | No | Nothing |

### Rules flow 2 depends on

1. Every eligible session gets a feedback prompt when it ends. Browser
   notifications plus a pop-up on the next visit is the tentative delivery; the
   exact mechanism is decided later.
2. Until a prompt is answered, the schedule assumes the session was done.
   Students are expected to follow their schedule. The tradeoff: a late "no"
   means the made-up work is placed later, and near a deadline it may no longer
   fit.
3. Missed sessions are greyed out, not deleted. Skipped sessions are data about
   when this student doesn't work.
4. Milestones are coarse in the MVP. A session with no milestone checked off
   counts as no progress.
5. Students can log progress from the to-do list at any time. The planner asks
   how long it took, then follows the same steps as a session prompt.
6. Session logs adjust the current assignment right away. Only a finished
   assignment's total time is used as a training example, because time logged on
   unfinished work is a lower bound, not a completed duration.
7. When the planner makes a schedule, it records each prediction with its inputs,
   so predictions can be compared with outcomes later.

## Still open

- Which preferences the planner must collect at onboarding, and what the defaults
  are. Tracked as question 8 in [open planning questions](../questions.md).
- How urgency is defined when choosing which floating tasks to move: nearest
  deadline, most remaining work, or a mix.
- How sessions are sized, for example a minimum and maximum session length.
