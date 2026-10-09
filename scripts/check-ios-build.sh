#!/usr/bin/env bash
set -euo pipefail

[ "$#" -eq 1 ] || { echo "usage: check-ios-build.sh <previous-tag>" >&2; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
previous="refs/tags/$1"
git rev-parse --verify "${previous}^{commit}" >/dev/null 2>&1 || {
  echo "✗ check-ios-build: previous tag '$1' not found" >&2
  exit 1
}

# Compare the release with the working tree as well as committed changes; only native inputs count.
paths=(
  ios/CollieIsland ios/IslandWidget ios/Shared ios/Support
  ios/CollieIsland.xcodeproj ios/Config.xcconfig
  ':(exclude)**/*.md'
)
untracked="$(git ls-files --others --exclude-standard -- "${paths[@]}")"
if git diff --quiet "$previous" -- "${paths[@]}" && [ -z "$untracked" ]; then
  echo "✓ check-ios-build: native inputs unchanged since $1"
  exit 0
fi

read_build() {
  awk '
    /CURRENT_PROJECT_VERSION[[:space:]]*=/ {
      value = $0
      sub(/^.*CURRENT_PROJECT_VERSION[[:space:]]*=[[:space:]]*/, "", value)
      sub(/;[[:space:]]*$/, "", value)
      if (value !~ /^[0-9]+$/ || (count > 0 && value != build)) invalid = 1
      build = value
      count++
    }
    END {
      if (count != 4 || invalid) exit 1
      print build
    }
  '
}
project=ios/CollieIsland.xcodeproj/project.pbxproj
old_build="$(git show "${previous}:$project" | read_build)" || {
  echo "✗ check-ios-build: $1 must have four matching integer CURRENT_PROJECT_VERSION values" >&2
  exit 1
}
new_build="$(read_build < "$project")" || {
  echo "✗ check-ios-build: $project must have four matching integer CURRENT_PROJECT_VERSION values" >&2
  exit 1
}
if [ "$new_build" -le "$old_build" ]; then
  echo "✗ check-ios-build: native inputs changed since $1, but CURRENT_PROJECT_VERSION ($new_build) must be greater than $old_build; bump all four app/widget configurations" >&2
  exit 1
fi
echo "✓ check-ios-build: native inputs changed; build $old_build → $new_build"
