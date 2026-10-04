---
created: 2026-10-03
updated: 2026-10-04
---

# UI/UX

## Status

The UI/UX work described here is a proposal by Howard Xu on branch
`hxu/ui-first-pass`. It has not been reviewed or adopted by the team. This page
explains what the UI/UX is trying to achieve and where each piece of UI/UX
documentation lives, so a teammate can get up to speed quickly.

## Goal

The product's goal (see the [overview](../../docs/overview.md)) is to automate scheduling for
students. The UI/UX goal is to make that automation something a student trusts and
keeps using: it should take almost no effort to put work in, and it should always be
clear what the planner did and how to change it.

The flows and rules follow from these principles:

1. **Minimal input, in the student's own terms.** Students answer only what the planner
   cannot work out itself, and never sort tasks into categories. The first choice is
   whether they have a time for the task: picking one makes it anchored, and leaving it
   to the planner makes it floating. Where the student starts already suggests the
   answer: clicking an empty calendar slot starts an anchored task at that time, and the
   Add task button starts a floating one. Milestones, instructions, and repeats are
   optional.
2. **Automatic, but never set in stone.** The planner schedules without asking for
   approval. The student can see the schedule at any time and move, anchor, let float, edit,
   or delete anything.
3. **The student's choices win.** Anchored events, classes, and anything the student
   moved stay put. When the student's own action creates an overlap, they decide
   whether to move the other event or keep both. The student can override any estimate.
4. **Say what happened, and offer choices when something does not work.** Every change
   is reported (what was scheduled, what moved). When work does not fit, the student
   chooses how to make room or accepts a partial schedule; nothing is dropped silently.
5. **Feedback is quick and low-pressure.** After a session, one question comes first,
   prompts can wait and stack up, and "skip for now" is always there. Answers adjust
   the rest of the schedule and, for assignments, improve future estimates.

## Where UI/UX documentation lives

Each file has one job. Put new information in the file whose job it matches.

| File | Its job | What belongs there | What does not |
| --- | --- | --- | --- |
| [docs/overview.md](../../docs/overview.md) | The product: problem, goal, users, scope, success | Why the project exists and what is in or out of scope | UI rules or screens |
| **plan/uiux/ui-ux.md** (this file) | Entry point for UI/UX | The UI/UX goal and principles, and this map of files | Rules, screens, or status |
| [plan/uiux/user-flows.md](user-flows.md) | **Source of truth for when and whether a task gets scheduled** | Both master flowcharts (each with smaller charts of its parts, derived from the master), what each input means to the planner, the repeat model, who gets which prompts, every rule that decides when or whether work is scheduled, the rule reference (with placeholders and prototype limits marked), and open scheduling questions. All of it stated in terms of general inputs ("a session ends", "the student keeps the overlap") | What an input looks like on screen; other UI rules; how the prototype is built |
| [prototype/DESIGN.md](../../prototype/DESIGN.md) | **Source of truth for what each input looks like in practice, the other UI rules**, and how the prototype was built | The input mapping (which pop-up, button, or gesture produces each input in user-flows.md, and how its states are shown), screens and the rules that make the process work on screen (dialog mechanics, form checks, defaults in forms, wording, feedback messages, formats), open UI-only choices, build process, architecture, data model, sample data, which code implements each rule, traps found, verification | Rules that change when or whether work is scheduled (those go in user-flows.md) |
| [prototype/README.md](../../prototype/README.md) | Running the prototype | How to open it, how to run the tests, a walkthrough for trying each flow | Rules or design rationale |
| [prototype/](../../prototype/) code | The working prototype | `index.html`, `styles.css`, `js/` (scheduling rules in `js/engine.js`), `test/` | Documentation |
| [plan/active.md](../active.md) | Handoff | Current state: what is uncommitted, how to verify, what is undecided, the next step | The history of changes; rules or design that other files own |
| [plan/uiux/ui-first-pass-changelog.md](ui-first-pass-changelog.md) | Changelog | What changed and when on the UI first pass. It records history; it is not a source of truth for logic | Current state or next steps (those go in active.md); rules or design that other files own |
| [plan/questions.md](../questions.md) | Project-wide open questions | Questions that block scope, stack, or delivery (question 8 covers scheduling preferences) | UI-only questions (scheduling ones go in user-flows.md, the rest in DESIGN.md) |
| [Figma file](https://www.figma.com/design/WfwTiXHXI0EWa2wmuamydZ/senior-design) | Visual mockups | Screen layouts and visual style | Behavior; when a mockup disagrees with user-flows.md or DESIGN.md, those files win |

## Getting up to speed

1. Read the [overview](../../docs/overview.md) for the product, then this page.
2. Read [user-flows.md](user-flows.md): the two flowcharts first, then the
   rules and the rule reference.
3. Open the prototype ([README](../../prototype/README.md)) and try each flow.
4. Read [DESIGN.md](../../prototype/DESIGN.md) if you will change the prototype.

## Changing the UI/UX

Where a rule goes: if it decides when or whether work is scheduled, it belongs in
user-flows.md, stated as a general input and its outcome ("until the student gives
feedback, the session is assumed done"). What the input looks like in practice belongs in
DESIGN.md ("closing the feedback pop-up means no feedback yet"), along with everything
else on screen. A redesign that only changes how inputs look should not touch
user-flows.md.

1. **A scheduling rule or flow changes:** edit user-flows.md first. Then update the
   prototype and its tests, then DESIGN.md if the implementation changed.
2. **How something looks or is done on screen changes** (a screen, dialog, gesture, form
   check, default, or wording): update DESIGN.md's "Input mapping" or "UI rules", then
   the prototype (and the README if running or
   trying it changed).
3. **A new open question:** scheduling questions go in user-flows.md under "Still open";
   other UI questions go in DESIGN.md under "Open choices"; questions that affect scope,
   stack, or delivery go in plan/questions.md.
