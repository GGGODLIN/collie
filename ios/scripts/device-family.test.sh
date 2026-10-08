#!/usr/bin/env bash
set -euo pipefail

[ "$#" -eq 1 ] || { printf 'usage: device-family.test.sh <CollieIsland.app>\n' >&2; exit 2; }

# 只檢查原始設定，無法確認 app 與內嵌 extension 實際帶出的裝置支援。
python3 -I - "$1" <<'PY'
import pathlib
import plistlib
import sys

app = pathlib.Path(sys.argv[1])
plists = [app / "Info.plist", app / "PlugIns/IslandWidgetExtension.appex/Info.plist"]
failures = []
for path in plists:
  with path.open("rb") as source:
    info = plistlib.load(source)
  family = info.get("UIDeviceFamily")
  if family != [1, 2]:
    failures.append(f"FAIL: {path.parent.name} UIDeviceFamily={family!r}, expected [1, 2]")
  else:
    print(f"PASS: {path.parent.name} supports iPhone and iPad")
  if path == plists[0]:
    orientations = info.get("UISupportedInterfaceOrientations~iphone", info.get("UISupportedInterfaceOrientations"))
    if orientations != ["UIInterfaceOrientationPortrait"]:
      failures.append(f"FAIL: iPhone orientations={orientations!r}, expected portrait only")
    else:
      print("PASS: iPhone keeps its portrait-only orientation")
    ipad_orientations = info.get("UISupportedInterfaceOrientations~ipad", info.get("UISupportedInterfaceOrientations", []))
    expected_ipad = {
      "UIInterfaceOrientationPortrait",
      "UIInterfaceOrientationPortraitUpsideDown",
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight",
    }
    if set(ipad_orientations) != expected_ipad:
      failures.append(f"FAIL: iPad orientations={ipad_orientations!r}, expected all four orientations")
    else:
      print("PASS: iPad declares all four orientations")
if failures:
  print("\n".join(failures), file=sys.stderr)
  sys.exit(1)
PY
