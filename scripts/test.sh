#!/usr/bin/env bash
# Targeted tests. Pass a path or a test-name filter:
#   ./scripts/test.sh web/src/domain                 # one folder of the web app
#   ./scripts/test.sh -t "fit check"                 # web tests whose name matches
#   ./scripts/test.sh backend/tests/test_timer.py    # a backend file (once backend/ exists)
#   ./scripts/test.sh -k schedule                    # backend tests matching an expression
# With no arguments, runs every suite that exists.
set -euo pipefail

cd "$(dirname "$0")/.."

run_web() {
  if [ ! -d web/node_modules ]; then
    echo "web/node_modules is missing. Run: (cd web && npm install)" >&2
    exit 1
  fi
  # Vitest runs from web/, so paths given from the repository root drop their web/ prefix.
  local args=()
  for a in "$@"; do args+=("${a#web/}"); done
  (cd web && npx vitest run "${args[@]+"${args[@]}"}")
}

run_backend() {
  if [ ! -d backend ]; then
    echo "No backend/ directory yet — nothing to test there."
    return 0
  fi
  local args=()
  for a in "$@"; do args+=("${a#backend/}"); done
  (cd backend && uv run pytest "${args[@]+"${args[@]}"}")
}

case "${1:-}" in
  "") [ -d web ] && run_web; run_backend ;;
  backend/* | -k) run_backend "$@" ;;
  *) run_web "$@" ;;
esac
