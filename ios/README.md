# Collie Island

An iPhone app that opens your Collie and puts its agents' state on the Dynamic Island. Tap the
island and it jumps to the pane that needs you most.

It is built from source and signed with your own Apple ID. A free Apple ID is enough: no paid
developer account, no APNs, no third-party server. It is not on the App Store and cannot be: it
stays awake in the background through location updates, which App Review does not accept for this
purpose.

## Set it up

You need a Mac with Xcode, an iPhone on iOS 18 or newer, and a Collie the phone can already reach
(usually its tailnet front door, with Tailscale on the phone).

1. Create your own settings file from the template.

   ```bash
   cp ios/Config.local.example.xcconfig ios/Config.local.xcconfig
   ```

2. Fill in its values: your Team ID, a bundle ID prefix of your own, and your Collie's address.
3. Connect the iPhone to the Mac with a cable and trust the Mac on the phone.
4. Open `ios/CollieIsland.xcodeproj` in Xcode and sign in to your Apple ID under Settings → Accounts.
5. Choose your iPhone as the run destination and press Run.
6. On the phone, trust your developer certificate (Settings → General → VPN & Device Management) and
   turn on Developer Mode.
7. Open the app and allow location **Always**, so the island keeps updating in the background.

Every value lives in `Config.local.xcconfig`, which git ignores; `Config.xcconfig` only holds the
defaults. An app built without a Collie address opens on a line saying so, and fetches nothing.

## How it works

```
iPhone (Tailscale on)
  Collie Island
    ├─ WKWebView ── loads Collie; its settings and pairing are also kept in the Keychain
    ├─ GET /api/snapshot every 5 s → "needs you / done / working"
    │     └─ Activity.update() updates the Live Activity locally (no push)
    └─ background location ("Always", 100 m accuracy) keeps the app from being suspended
```

- It works with any Collie, this fork's or upstream's: it only reads `/api/snapshot`.
- The buckets copy Collie's `web/src/lib/triage.ts` (`bucketOf`) in
  [Shared/Triage.swift](./Shared/Triage.swift). When the island and Collie disagree, check that
  copy first.
- `Activity.request` must pass `pushType: nil`. A Personal Team build has no push entitlement, and
  asking for a push token fails the whole request
  ([LoopKit/Loop#2532](https://github.com/LoopKit/Loop/issues/2532)).
- Silent audio does not keep it awake: liveactivitiesd refuses updates from a process that only
  plays background media ([Apple forums 748569](https://developer.apple.com/forums/thread/748569)).
  Background location is not an Apple-supported way to do this either, and an iOS update may end it.
- Location is "Always" with `showsBackgroundLocationIndicator = false` and no
  `CLBackgroundActivitySession`, so the blue location arrow does not take over the island
  ([QA1965](https://developer.apple.com/library/archive/qa/qa1965/_index.html)).

## Re-signing every 7 days

A free Apple ID signs the app for 7 days. [scripts/resign.sh](./scripts/resign.sh) rebuilds and
reinstalls it with a fresh profile; it reads the same `Config.local.xcconfig`, plus
`ISLAND_DEVICE_ID` (from `xcrun devicectl list devices`). The phone must be on a cable or the same
Wi-Fi as the Mac.

```bash
bash ios/scripts/resign.sh --force
```

Its log is `~/Library/Application Support/collie-island/resign.log`. To run it daily, point a
launchd agent at it: without `--force` it renews only once fewer than `ISLAND_RENEW_BELOW_DAYS` days
remain (2 by default), so most runs leave the app alone. Xcode reuses a still-valid profile, so the
script moves this app's old profiles aside first; otherwise the expiry would not move. With
`ISLAND_RESTART_COREDEVICE = YES`, a failed install restarts this user's CoreDevice daemons and
retries once; they serve every device the Mac talks to, so it is off by default.

Reinstalling closes the app, and the island stays gone until it is restarted (next section).

## The 8-hour limit

iOS shows a Live Activity for at most 8 hours, and an app can normally start one only in the
foreground. `RestartIslandIntent` is the exception and can restart it in the background, from:

- the Control Center button "重啟 Collie 靈動島", or
- a Shortcuts automation that runs the "重啟靈動島" shortcut, for example every 8 hours.

## Known limits

- Apple throttles frequent island updates. Content changes go out at most every 30 s (a newly
  blocked agent at once) with a 60 s heartbeat, so the island greys within about 3 to 4 minutes after
  updates stop. The numbers are in [CollieIsland/Config.swift](./CollieIsland/Config.swift).
- Battery use in the background has not been measured.
- The app's diagnostic log can be copied off the phone:
  `xcrun devicectl device copy from --device <id> --domain-type appDataContainer --domain-identifier <your bundle ID> --source Documents/island.log --destination island.log`.
- The Collie inside the app does not share storage with the home-screen PWA, so pair it once more.
  After that its settings and pairing are backed up to the Keychain and restored if the web storage
  is ever emptied (`collieisland://debug-wipe` tests that). The web view is not created before the
  phone's first unlock, because "Always" location lets iOS start the app earlier than that.
- Web Push does not work inside the app; the PWA keeps delivering notifications.
- The app's own text (the location prompt, the Control Center button) is in Traditional Chinese.
