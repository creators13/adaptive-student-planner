#!/usr/bin/env bash
# Targeted tests. Pass a path or a -k expression:
#   ./scripts/test.sh backend/tests/test_timer.py
#   ./scripts/test.sh -k schedule
# With no arguments, runs the backend suite.
#
# Skips cleanly while backend/ does not exist.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d backend ]; then
  echo "No backend/ directory yet — nothing to test."
  echo "See plan/roadmap.md for what is built when."
  exit 0
fi

cd backend
exec uv run pytest "$@"
