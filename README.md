# Adaptive Student Planner

Last updated: 2026-09-20

A student planner that learns how long your work actually takes. You enter or
import assignments, the system estimates the effort each one needs, proposes a
weekly schedule you approve, records the time you really spend, and uses that
feedback to improve future estimates.

Built as a UPenn CIS 4000/4100 senior project (Fall 2026 – Spring 2027).

## Status

Pre-implementation. This repository currently contains project context and
planning only — no application code has been written yet. See
[plan/active.md](plan/active.md) for what is in flight and
[plan/roadmap.md](plan/roadmap.md) for the build order.

## Where things live

| Path | Contents |
|---|---|
| [AGENTS.md](AGENTS.md) | Operating rules for humans and AI coding agents |
| [docs/](docs/) | Durable truth about the current system |
| [plan/](plan/) | Intent: active work, roadmap, backlog, specs |
| [scripts/](scripts/) | `check.sh` (full verification), `test.sh` (targeted tests) |

Start with [docs/overview.md](docs/overview.md) for the problem and product
shape, then [docs/architecture.md](docs/architecture.md) for how the pieces fit.
