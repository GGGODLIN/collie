#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
new_repo() {
  repo="$work/$1"
  mkdir -p "$repo/scripts" "$repo/ios/CollieIsland" "$repo/ios/CollieIsland.xcodeproj"
  cp "$ROOT/scripts/check-ios-build.sh" "$repo/scripts/"
  git -C "$repo" init -q
  git -C "$repo" config user.name "iOS build test"
  git -C "$repo" config user.email test@example.com
  write_build 1
  echo 'let old = true' > "$repo/ios/CollieIsland/App.swift"
  echo '# iOS app' > "$repo/ios/README.md"
  git -C "$repo" add .
  git -C "$repo" -c core.hooksPath=/dev/null commit -qm base
  git -C "$repo" tag v1.0.0
}
write_build() {
  printf 'CURRENT_PROJECT_VERSION = %s;\n' "$1" "$1" "$1" "$1" > "$repo/ios/CollieIsland.xcodeproj/project.pbxproj"
}
check() { bash "$repo/scripts/check-ios-build.sh" v1.0.0; }

new_repo unchanged
check || fail 'unchanged native inputs must pass'

new_repo native-without-bump
echo 'let added = true' >> "$repo/ios/CollieIsland/App.swift"
if output="$(check 2>&1)"; then fail 'native changes without a build bump must fail'; fi
case "$output" in
  *'must be greater than 1'*) echo "✓ refused native changes without a bump: $output" ;;
  *) fail "missing actionable failure: $output" ;;
esac

new_repo native-with-bump
echo 'let added = true' >> "$repo/ios/CollieIsland/App.swift"
write_build 2
git -C "$repo" add .
git -C "$repo" -c core.hooksPath=/dev/null commit -qm 'native update'
check || fail 'committed native changes with a build bump must pass'

new_repo readme-only
echo 'Documentation only' >> "$repo/ios/README.md"
check || fail 'README changes alone must pass'

# Every native input in the release brief must trigger the comparison, not only Swift sources.
for path in ios/IslandWidget/Widget.swift ios/Shared/Triage.swift ios/Support/App-Info.plist ios/CollieIsland.xcodeproj/project.pbxproj ios/Config.xcconfig; do
  new_repo "input-$(basename "$path")"
  mkdir -p "$(dirname "$repo/$path")"
  echo '// new native input' >> "$repo/$path"
  if check >/dev/null 2>&1; then fail "native change missed: $path"; fi
  echo "✓ refused unbumped native input: $path"
done

new_repo mismatched-builds
echo 'CURRENT_PROJECT_VERSION = 2;' > "$repo/ios/CollieIsland.xcodeproj/project.pbxproj"
if check >/dev/null 2>&1; then fail 'incomplete build configurations must fail'; fi

new_repo missing-tag
if bash "$repo/scripts/check-ios-build.sh" absent >/dev/null 2>&1; then fail 'missing tag must fail'; fi

echo '✓ check-ios-build.test.sh — 11 cases passed'
