#!/bin/bash
# One command for the whole live suite: build the world, run every spec, tear the world down.
# The teardown runs whatever the specs did, and the exit status is the specs' own.
#
#   bash e2e-live/run.sh [extra playwright args...]
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"

bash "$here/session.sh" down >/dev/null 2>&1 || true
trap 'bash "$here/session.sh" down' EXIT

bash "$here/session.sh" up || exit 1
(cd "$repo/web" && bunx playwright test -c ../e2e-live/playwright.config.ts "$@")
