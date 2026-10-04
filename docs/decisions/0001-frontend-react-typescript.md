# 0001: Build the frontend first draft in React and TypeScript

Status: **Proposed** (2026-10-04)

Decision owner: Howard Xu, for branch `hxu/ui-first-pass`. The team accepts or rejects it
by reviewing the pull request from that branch.

Implementation: done on the branch. The app is in [web/](../../web/README.md).

## Problem

The UI prototype began as plain HTML, CSS, and JavaScript with no packages, so that it would
not choose a stack before the team did. Howard decided the prototype should be a first
draft the team builds on, not a throwaway. That needs a frontend stack the whole team can
work in, test, and extend toward a real product: accounts, a backend, the LLM, Google
Calendar sync, and slow jobs that report back later.

The project-wide stack question is still open ([question 4](../../plan/questions.md)). This
record covers only the frontend.

## Options considered

1. **Keep plain HTML, CSS, and JavaScript.** No install or build step, and nothing new to
   learn. But the prototype had already grown its own small framework (an element builder,
   a store that redraws the whole page, promise-based dialogs). Teammates would have to
   learn that instead of something common, and it gets harder to keep up as the app grows
   (server data, forms that keep their state, a calendar library).
2. **React with TypeScript, built with Vite.** The most common choice among students and the
   largest set of libraries (calendars, drag and drop, server-data caching, testing).
   TypeScript fits the structured scheduling data. Costs: an install and build step,
   dependencies to keep current, and a learning curve for anyone new to React.
3. **Vue or Svelte.** Similar benefits to React with smaller ecosystems. A reasonable choice
   if the team prefers one of them.

## Proposed choice

Option 2: React 19, TypeScript in strict mode (no `any`, as AGENTS.md asks), and Vite, in
`web/`, where `scripts/check.sh` already expected the frontend. Tests use Vitest and Testing
Library; linting uses ESLint with typescript-eslint and the React hooks rules. No router or
state library yet: four screens and one store did not need them.

Not part of this choice: the backend, the database, hosting, and whether a backend (for
example FastAPI, which suits the Python duration model) is added later.

## Consequences

- Running the app needs Node 22.22 or newer and `npm install`; it no longer opens from a
  file. `./scripts/check.sh` now runs lint, typecheck, tests, and a build for `web/`.
- The scheduling engine is plain TypeScript with no React (`web/src/domain/`), so it can be
  tested alone and moved to a backend later.
- The conversion kept behavior identical to the plain-JS prototype (checked by screenshots
  and a side-by-side walkthrough; see [web/DESIGN.md](../../web/DESIGN.md), section 13). The
  plain-JS code was removed from the branch; it remains in commit `8155c87`.

## Evidence

- Howard, 2026-10-04, in a Claude Code session: "We should make this branch a first-draft
  prototype, not a throwaway," then asked for the conversion to React to start. He set the
  approval path: "We do not need team approval because I am working on my branch. The team
  will approve when I make my PR."
- Acceptance: pending team review of the pull request.
