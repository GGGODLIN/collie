#!/bin/bash
# Builds an unsigned CollieIsland.ipa for sideloading: AltStore and tools like it re-sign it with
# the installer's own Apple ID. Nothing of the builder's is compiled in. The command-line settings
# below outrank Config.local.xcconfig, so running this in a checkout that has one still leaves out
# its Team ID and Collie address; the app asks for the address on first open.
#
# The release workflow runs this on a macOS runner and attaches the result to the GitHub release.
set -euo pipefail

[ "$#" -eq 1 ] || { echo "usage: build-ipa.sh <output.ipa>" >&2; exit 2; }
out_dir="$(cd "$(dirname "$1")" && pwd)"
out="$out_dir/$(basename "$1")"
ios="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

xcodebuild archive \
  -project "$ios/CollieIsland.xcodeproj" -scheme CollieIsland -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$work/CollieIsland.xcarchive" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" DEVELOPMENT_TEAM="" \
  BUNDLE_ID_PREFIX=com.example COLLIE_URL="" ISLAND_SHOW_DETAIL=NO \
  -quiet

app="$work/CollieIsland.xcarchive/Products/Applications/CollieIsland.app"
# A published .ipa that opened on somebody's own Collie would be a leak, not a default.
url="$(/usr/libexec/PlistBuddy -c "Print CollieURL" "$app/Info.plist")"
[ -z "$url" ] || { echo "build-ipa.sh: the app carries a Collie address ($url); refusing" >&2; exit 1; }

mkdir "$work/Payload"
cp -R "$app" "$work/Payload/"
rm -f "$out"
(cd "$work" && zip -qry "$out" Payload)
echo "$out"
