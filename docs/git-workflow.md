---
created: 2026-09-22
updated: 2026-09-22
---

# Git workflow and conventions

## Status

Adopted by Allen, the repo owner, on 2026-09-22. This is the current policy;
team ratification is not required. Direct commits to `main` are allowed.

## Purpose

This file is the shared contract for how work enters this repository — for the
six of us and for every AI coding assistant we point at it. Read it once before
your first commit.

It exists because of a specific risk. This course expects us to use AI tools,
and grades architecture, correctness, and real-world usefulness far above code
volume. That combination makes it easy to generate a large amount of plausible
code quickly and lose track of what is actually true in the repository. Git
discipline is what keeps that from happening.

**One rule above all the others:** the person committing is the author.
Not "the agent wrote it." You own every line you commit, including the lines you
did not type. An agent will never be the one debugging this at 2am the night
before the demo.

---

## Branching and commits

Branches are optional. Use one when it helps isolate risky or concurrent work;
direct commits to `main` are acceptable for this project.

```
main ──► focused commit ──► verify ──► continue
  └── optional task branch ──► merge when useful
```

| Rule | Detail |
|---|---|
| Branch per change | One branch, one purpose. If you cannot name it in a few words, it is two branches. |
| Keep them short | Under three days. A week-old branch is a merge conflict with a countdown timer. |
| Review before commit | Read the actual diff and verify the intended files before committing. |
| Keep commits focused | One logical change per commit makes history useful. |
| Coordinate shared files | Tell teammates before changing shared configuration, migrations, or dependencies. |

Self-merge is a trust-based shortcut, not a licence to skip reading. Read your
own diff before merging — especially when an agent produced it.

### Branch names

`<type>/<short-description>`, lowercase, hyphen-separated:

```
feat/assignment-import      fix/timer-resume-after-refresh
docs/architecture-update    chore/bump-deps
refactor/schedule-solver    test/authorization-cross-user
```

---

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<optional scope>): <short description>

<optional body — why, not what>

<optional footer>
```

| Type | Use for |
|---|---|
| `feat` | A new capability |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `refactor` | Restructuring with no behavior change |
| `test` | Adding or fixing tests |
| `perf` | Performance work |
| `chore` | Dependencies, tooling, config |
| `ci` | CI configuration |

Rules:

- Description is **imperative mood**, lowercase, no trailing period:
  "add timer pause handling", not "added" or "Adds".
- The subject line says *what*. The body says *why*. Anyone can read the diff
  for the what; only you know the why.
- One logical change per commit. If the message needs the word "and", split it.
- Scope is optional and names an area: `feat(scheduler):`, `fix(auth):`.

```
feat(timer): persist session state across page reloads

A refresh previously dropped the in-progress session. Logged time is the
training signal for duration estimates, so silently losing it is worse
than a visible bug.
```

Why bother: history stays searchable six months from now, the Spring writeup
becomes easy to assemble, and the format forces the small act of deciding what
a commit actually *is*.

### Commit size and cadence

Commit when a small thing works — not when the feature is done. Each commit is
a save point you can return to.

**Target under ~200–300 changed lines per commit.** Review effort scales with
diff size, and past a screenful people stop reading and start skimming. If a
diff does not fit on your screen, it will not get read; it will get merged.

---

## Rules for AI coding assistants

Claude Code, Codex, and anything similar must follow these. Worth pasting into
any agent's own instruction file too.

### Never, without being asked

| Prohibited | Why |
|---|---|
| `git push --force` on a shared branch | Destroys work others or CI already have. The human pays for this, not the agent. |
| `git rebase` or amend on already-pushed commits | Rewriting published history breaks everyone else's clone. |
| `git reset --hard` without explicit instruction | Silently discards uncommitted work that may not be yours. |
| Rewrite shared history | Force pushes, rebases, and amended published commits can destroy teammates' work. |
| Commit at all unless asked | Committing is a decision. Agents propose; humans decide when work lands. |

### Always

- **Stage explicitly. Never `git add -A` or `git add .` blindly.** If another
  session, teammate, or background tool has uncommitted work in the tree, a
  blanket add sweeps it in. This is the most common way people commit code they
  did not write — including debug statements and test credentials. Name the
  files, or run `git status` and justify each one.
- **Verify before claiming.** Run `git log -1 --stat` or `git status` and read
  the output. Never report repository state from memory or assumption.
- **Keep the diff to the request.** If the task was "add an empty state," the
  commit does not also rename shared types and reformat a neighboring file.
  Unrelated cleanup is separate work with its own review surface.
- **Flag new dependencies.** Agents reach for packages readily. Any new entry in
  `package.json` or `pyproject.toml` needs a stated reason in the commit or handoff.
- **Never commit secrets.** No `.env`, keys, tokens, or real student data. If one
  is ever committed, rotate it — deleting it from history is not enough, because
  it was already pushed.

### Recovery

Almost nothing in git is truly lost for 30 days.

```bash
git reflog                       # every HEAD position, including "lost" commits
git reset --hard <sha-from-reflog>
git stash                        # park uncommitted work safely
git restore <file>               # discard changes to one file
```

Before letting an agent loose on a large refactor, leave yourself an anchor:

```bash
git tag pre-refactor-$(date +%Y%m%d)
```

---

## Reviewing AI-written code

Applies to reviewing your own agent's output before committing and to reviewing
teammates' changes.

Agents produce code that *looks* complete. That is exactly the dangerous failure
mode: volume is no longer a proxy for effort, and tidiness is no longer a proxy
for correctness.

**Read the diff, not the agent's summary.** The summary is a claim about the
change. The diff is the change. They are not always the same thing.

A workable order for a large diff:

1. **Get the silhouette first.** `git diff --stat`. How many
   files, which directories, where are the outliers? Build a map before reading
   a single line.
2. **Compare against the original request.** Did it do what was asked, and only
   what was asked? Unrequested refactoring is a stop sign, however good it looks.
3. **Read the imports and lockfile changes.** A heavyweight new dependency for a
   trivial task, or an invented import, is a red flag you can spot in seconds.
4. **Check nothing weakened the safety net.** Tests removed, renamed, or skipped;
   coverage thresholds lowered; CI steps newly conditional. Any of these needs an
   explicit justification before anything else matters.
5. **Look for duplicated knowledge.** Agents replicate a nearby pattern rather
   than finding the existing helper. New utilities that duplicate existing ones
   are the most common quality problem in agent diffs.
6. **Read the unhappy paths first.** The happy path usually works. Errors, empty
   states, and boundaries are where the gaps are.
7. **Treat tests as claims, not proof.** Tests written by the same agent that
   wrote the code test that agent's understanding of the problem. If that
   understanding was subtly wrong, the tests lock the bug in rather than catching
   it. Read them with the same skepticism as the code.
8. **Slow down on auth, data, and migrations.** Here that means ownership checks,
   the worker's privileged path, work-session arithmetic, and the schema.

If a change is too large to read honestly, split it before committing. That is a
legitimate review outcome, not a failure of diligence.

---

## Conflict hotspots

Six people on one repository collide in predictable places. These need
coordination, not cleverness:

| File | Rule |
|---|---|
| Lockfiles (`package-lock.json`, `uv.lock`) | Never hand-edit or hand-merge. On conflict take `main`'s version, re-run the install, commit the regenerated file. |
| Database migrations | Never edit an applied migration — add a new one. Two people writing migrations the same day should agree on ordering before both merge. |
| Shared config (`vite.config`, `pyproject.toml`, CI workflows) | Small focused commits. Say so in the team channel when you change one. |
| Generated files | Do not edit by hand. Regenerate. |
| Barrel / index files | A common false-conflict source. Re-check that the merged result compiles rather than trusting the resolution. |

Rebase on `main` regularly (`git pull --rebase origin main`) so conflicts arrive
one at a time instead of all at once at merge.

**Rebase your own unpushed branch: yes. Rebase anything others have pulled: no.**

---

## Never committed

- `.env`, `.env.*`, any key, token, or credential
- Real student data from the pilot — consented research data, not fixtures
- `node_modules/`, `.venv/`, build output, `.DS_Store`
- Trained model artifacts (versioned in storage, not git)
- Large binaries

See [`.gitignore`](../.gitignore). If something slips through, remove it *and*
rotate the credential.

---

## Sources

Drawn from the
[Conventional Commits v1.0.0 spec](https://www.conventionalcommits.org/en/v1.0.0/)
and current practitioner writing on git discipline under AI-assisted development.
Adapted to a six-person, two-semester student project.
