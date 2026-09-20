#!/usr/bin/env bash
# Full verification: lint, typecheck, test, build.
# Run this before opening a pull request and quote its output as evidence.
#
# Sections for directories that do not exist yet are skipped, so this script is
# safe to run on the current pre-implementation repository. When you create
# web/ or backend/, uncomment the matching commands in the same change.
set -euo pipefail

cd "$(dirname "$0")/.."
ran=0
skipped=()

section() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

if [ -d web ]; then
  section "Frontend"
  (cd web && npm run lint && npm run typecheck && npm test && npm run build)
  ran=$((ran + 1))
else
  skipped+=("frontend (web/ does not exist)")
fi

if [ -d backend ]; then
  section "Backend"
  (cd backend && uv run ruff check . && uv run mypy app && uv run pytest)
  ran=$((ran + 1))
else
  skipped+=("backend (backend/ does not exist)")
fi

section "Summary"
echo "sections run: $ran"
for s in "${skipped[@]:-}"; do
  [ -n "$s" ] && echo "skipped: $s"
done

if [ "$ran" -eq 0 ]; then
  echo
  echo "Nothing was verified. There is no application code in this repository yet."
fi
