---
created: 2026-10-04
updated: 2026-10-04
---

# Flowchart validation

Status: Proposed, with the rest of the UI work on branch `hxu/ui-first-pass`.

Purpose: show that the app in [web/](../../web/README.md) does what each step of the two
master flowcharts in [user-flows.md](user-flows.md) says. Every node is listed below with
what was checked and the test that checks it. The tests drive the app the way a student
would: clicking buttons, filling in forms, and ending sessions with the demo clock. They do
not call the scheduling engine directly.

**Result (2026-10-04): every node of both master flowcharts is covered, and all 40 tests
pass.** To check that the tests can fail, four rules were broken on purpose in the code
(classes prompt, every errand session prompts, 0 minutes is ignored, never make room); each
was caught by at least one test.

## How to run it

```bash
cd web
npx vitest run src/flows/validation          # 40 tests
npx vitest run src/flows/validation --reporter=verbose   # one line per test
```

`./scripts/check.sh` runs them too. Test names start with the chart nodes they walk, in
brackets, so a failing test points at a box in the chart.

## Keeping this current

When a master flowchart changes, update the matching rows here and the tests in
`web/src/flows/validation/`, in the same change. A node with no test is a gap; list it under
"Not covered" rather than leaving it out. The smaller charts under each master are derived
from it, so they are covered through the master.

## Flow 1: adding a task

Tests: `web/src/flows/validation/flow1.test.tsx`.

| Node | What the chart says | What is checked | Test (name starts with) |
| --- | --- | --- | --- |
| start, pick | The student adds a task and picks a time or not | Add task opens; choosing "Anchor it" or "Let it float" decides the path | every test in the file |
| f1 | Event or class, start and end to the minute, repeat | An event saved at 14:05–15:20 lands at exactly those minutes; a class needs a course | `[f2: No → done]`, `[f2: "not a class"]` |
| f2: No → done | No overlap: scheduled | No question is asked; the block is anchored at that time | `[f2: No → done]` |
| f2: "not a class" | Classes are overlapped silently | An event over a class, and a class over an event, both save with no question | `[f2: "not a class"]` |
| f2 (moving) | The overlap check runs when the student moves something too | Moving a session onto an event asks the question; the moved session becomes anchored | `[f2] the overlap check also runs` |
| f3: Keep overlap | The student keeps the overlap | Both stay where they are | `[f2: Yes → f3: Keep overlap → done]` |
| f3: Keep (not choosing) | Not choosing counts as keeping | Closing the question with Esc keeps both | `[f3: Keep] closing the overlap question` |
| f3: Move → f4: Yes → f5 | The student gives the anchored event a new time, for this event or all repeats | "All events in the series" moves both repeats; "This event" moves one | `[f3: Move → f4: Yes → f5 → done]`, `[f5] "this event"` |
| f5 (check again) | The edited event gets the same overlap check | After the gym is moved onto dinner, the student is asked about that overlap | `[f3: Move → f4: Yes → f5 → done]` |
| f4: No → f6 | A floating session is taken off and goes to the fit check | The session is removed, its minutes are placed again away from the new event, and a toast says it moved | `[f3: Move → f4: No → f6 → done]` |
| todo, type | Floating tasks go to the to-do list; class assignment or not | Both kinds are created from the Add task dialog and appear on Tasks | `[a1]`, `[type: No → o1 → fit]`, `[relax: No → part: No → none]` |
| a1 | Course, start after (default today), complete by (default anytime), repeat, can split (default yes) | The form opens with today, an empty deadline, and "can be split" checked | `[a1] a class assignment starts with` |
| a2: Yes → a3 | With instructions, the LLM estimates the time; milestones are optional, proposed and refined with the LLM | A (placeholder) estimate appears; milestones are generated; the chat splits them; without milestones the instructions estimate is used | `[a1 → a2: Yes → a3 → a4 → a5 → fit]`, `[a2: Yes → a3 → a5]` |
| a4 | The student says which milestones are already done | One milestone marked done is saved as done and not counted as remaining | `[a1 → a2: Yes → a3 → a4 → a5 → fit]` |
| a5 | The system estimates remaining time, and the student can override it | The override (200 minutes) becomes the time scheduled | `[a1 → a2: Yes → a3 → a4 → a5 → fit]` |
| a2: No → a6 | Without instructions the student gives the duration; milestones are optional | 1 h 30 m is scheduled as 90 minutes; milestones typed by hand replace the duration | `[a2: No → a6 → fit]`, `[a6] milestones written by hand` |
| o1 | Not an assignment: earliest and latest to the minute, duration, repeat, can split (default no) | "Can be split" starts unchecked; 13:07 to 16:00 is kept to the minute; the one session sits inside it | `[type: No → o1 → fit]` |
| prefs | Work hours, buffer, session lengths feed every fit check | Work hours of 10 PM to 3 AM put the session at night | `[prefs → fit]` |
| fit: Yes → done | Fits in free time before the deadline, within preferences, without moving placed work; splits into sessions if allowed | Four hours become several sessions, all inside work hours and the deadline buffer, overlapping nothing; another task's sessions do not move | `[fit: Yes → done]` |
| fit: No → bump: Yes → move | Less urgent floating tasks move, each re-placed by the fit check | The urgent task is scheduled; the less urgent one keeps all its minutes; the toast names it | `[fit: No → bump: Yes → move → done]` |
| bump: No → warn | Tell the student; offer later work hours or a smaller buffer, and how long the change lasts | The dialog says none of it fits and offers work hours, buffer, and four durations | `[bump: No → warn → relax: Yes → fit: Yes → done]` |
| relax: Yes → fit | Relaxing runs the fit check again | Work until midnight with no buffer fits; the task is scheduled; the relaxation is saved for this task only | `[bump: No → warn → relax: Yes → fit: Yes → done]` |
| relax: Yes → fit: No → warn | (the loop) | Relaxing too little shows the same dialog again | `[relax: Yes → fit: No → warn again → …]` |
| relax: No | The student keeps their preferences | Choosing to keep, or closing the dialog, saves no relaxation | `[relax: Yes → fit: No → warn again → …]`, `[relax: No] closing the does-not-fit pop-up` |
| part: Yes → partial | Splittable and part fits: partially scheduled, shortfall reported | What fits is placed; placed plus shortfall equals the whole; the toast and the Weekly Plan banner report it | `[relax: Yes → fit: No → warn again → relax: No → part: Yes → partial]` |
| part: No → none | Unscheduled, stays on the to-do list, flagged | No sessions; the banner flags it; Tasks lists it as Unscheduled | `[relax: No → part: No → none]` |

## Flow 2: after a session

Tests: `web/src/flows/validation/flow2.test.tsx`.

| Node | What the chart says | What is checked | Test (name starts with) |
| --- | --- | --- | --- |
| ended | A session ends | The demo clock passes a session's end ("End next session") | every test in the file |
| asks: No → quiet | Anchored events and classes, and earlier sessions of a task that is not an assignment, do not ask | None of them queue a question; only the last session of the errand does | `[asks: No → quiet]` |
| asks: Yes → ask | Assignment sessions and the last session of other tasks ask; unanswered requests wait and add up; until answered the session is assumed done | Two ended sessions give a count of 2 and "1 of 2", "2 of 2"; nothing is re-planned; Skip and Esc leave them waiting | `[asks: Yes → ask]`, `time set aside by hand` |
| which: No → d1: Yes → marked | Done? Yes: marked done | The task is complete; its time is not a training example | `[d1: Yes → marked]` |
| d1: Not yet → d2 | Student enters how much more time it needs | The minutes question appears after "Not yet" | `[d1: Not yet → d2 → d3: Extend → d4 → d6]` |
| d3: Extend → d4 → d6 | The session runs longer; overlap check; asks Done? again when it ends | The block ends 20 minutes later and is anchored; the overlap is asked about; it asks again at its new end | `[d1: Not yet → d2 → d3: Extend → d4 → d6]` |
| d3: Continue now → d5 → d6 | A new anchored block starts now; overlap check | A 30-minute anchored block starts at the current time; the overlap is asked about; the session counts as done, not missed | `[d3: Continue now → d5 → d6]` |
| d3: Finish later → refit1 | The rest goes to the fit check | A 30-minute floating session is placed later | `[d3: Finish later → refit1]` |
| which: Yes → s2 | Student reports minutes spent | The minutes question comes first | every assignment test |
| log → s2 | Progress outside a session, logged from the to-do list, follows the same steps | Log progress asks the same questions and records the minutes and milestone | `[log → s2]` |
| zero: Yes → skip → refit2 | 0 minutes: marked missed, kept as a record; an anchored block stays where it was; the missed work goes to the fit check | The session stays at its time, marked skipped; the minutes are placed again; for a set-aside (anchored) block, the new time is floating | `[s2 → zero: Yes → skip → refit2]`, `[skip] an anchored block` |
| hasms: No → sl → full: Yes → complete1 | 100% done: complete, remaining sessions removed, training example | The task is complete, no later sessions remain, and predicted vs actual (240 / 45) is stored | `[hasms: No → sl → full: Yes → complete1]` |
| full: No → reest | Less than 100%: re-estimate | 30% done of 120 minutes leaves 85 minutes | `[full: No → reest → pace: Behind → refit3]` |
| hasms: Yes → s3 → prog: No → small | No milestone finished: no progress; offer smaller milestones, by hand or with the LLM | The offer shows "Type them in" and "Chat with the assistant"; edited milestones replace the open ones; "Not now" keeps them | `[hasms: Yes → s3 → prog: No → small …]`, `[small] "Not now"` |
| prog: Yes → last: No → reest | Some milestones finished | The finished milestone and the time spent feed the re-estimate | `[prog: Yes → last: No → reest → pace: Ahead → trim]` |
| last: Yes → confirm | All finished: ask whether the whole assignment is finished | The question appears and cannot be closed without an answer | `[last: Yes → confirm: Yes → complete2]` |
| confirm: Yes → complete2 | Complete; remaining sessions removed; training example | The task is complete and 180 / 50 is stored | `[last: Yes → confirm: Yes → complete2]` |
| confirm: No → addms → reest | Student adds milestones, then re-estimate | The new milestone is added, open; the plan is re-estimated from it | `[confirm: No → addms → reest → pace]` |
| reest → pace: Behind → refit3 | The extra time goes to the fit check | Behind plans the extra minutes (slider case, and no-milestone-finished case) | `[full: No → reest → pace: Behind → refit3]`, `[hasms: Yes → s3 → prog: No → small …]` |
| pace: On track → updated | No change | Later sessions are exactly as before | `[pace: On track → updated]` |
| pace: Ahead → trim | Shorten or remove later sessions; freed time is not given to other tasks | The task drops to 90 minutes planned; another task's sessions do not move | `[prog: Yes → last: No → reest → pace: Ahead → trim]` |

Rules next to the chart that are also checked: a task that is not an assignment can be
marked done from the to-do list at any time (flow 2 rule 5), and time set aside by hand for
an assignment asks for feedback like a floating session (the prompt table).

## Not covered by these tests

- **Dragging blocks** on Weekly Plan needs real page layout, which the test browser does not
  have. Moving through Block details (same code path after the drop) is tested; the drag
  itself was checked in Chrome on 2026-10-04, including a class series (see
  [web/DESIGN.md](../../web/DESIGN.md#13-verification), section 13).
- **Browser notifications** when a session ends are not checked anywhere.
- The **rule reference** in user-flows.md has more detail than the charts (repeats, time of
  day, relaxation expiry, work hours past midnight). Those rules are covered by the engine
  tests in `web/src/domain/engine.test.ts`, not mapped row by row here.

## Observations for the team

Behavior that matches the charts but may not be what the team wants:

- **Adding milestones can shrink the plan.** In `[confirm: No → addms → reest → pace]`, the
  student finished all 180 planned minutes of milestones in 50 minutes, then added one
  30-minute milestone. The re-estimate scales it by their pace (about 25 minutes), which is
  less than the 130 minutes still planned, so the plan is trimmed and the toast says "Ahead
  of plan" right after the student said they are not finished. The chart sends `addms` to
  the same re-estimate as everything else, so this is correct by the chart. The team may
  want "not finished" to never trim, or a different message.
