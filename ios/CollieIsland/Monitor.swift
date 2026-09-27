import ActivityKit
import Foundation
import Network
import UIKit

@MainActor
final class Monitor: ObservableObject {
  // One instance for both the UI and RestartIslandIntent: the intent can launch the app in the
  // background, where no scene (and so no view-owned object) exists.
  static let shared = Monitor()

  private var activity: Activity<IslandAttributes>?
  private var last: IslandAttributes.ContentState?
  private var lastSent = Date.distantPast
  private var failures = 0
  private var loop: Task<Void, Never>?
  private var heartbeats = 0
  private var waitingLogged = false
  private var opening = false
  private let keeper = LocationKeeper()
  private let path = NWPathMonitor()

  init() {
    // The home Wi-Fi's Tailscale LAN path drops packets for hours at a time (upstream
    // tailscale#10356 reports it after a network switch), so every Wi-Fi/cellular change is
    // dated here to line up with the poll failures and the Mac's lan-watch.log.
    path.pathUpdateHandler = { p in
      let via = [(NWInterface.InterfaceType.wifi, "wifi"), (.cellular, "cellular"), (.wiredEthernet, "wired")]
        .filter { p.usesInterfaceType($0.0) }.map(\.1).joined(separator: "+")
      let line = "network \(p.status) via \(via.isEmpty ? "none" : via)"
      Task { @MainActor in DiagLog.write(line) }
    }
    path.start(queue: DispatchQueue(label: "collieisland.path"))
    // Swiping the app away should take the island with it; ActivityKit otherwise keeps showing
    // the last numbers as if live for up to eight hours.
    NotificationCenter.default.addObserver(
      forName: UIApplication.willTerminateNotification, object: nil, queue: .main
    ) { _ in Monitor.endAllBlocking() }
    for (name, label) in [
      (UIApplication.didEnterBackgroundNotification, "entered background"),
      (UIApplication.willEnterForegroundNotification, "entering foreground"),
    ] {
      NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { _ in
        MainActor.assumeIsolated { DiagLog.write(label) }
      }
    }
  }

  // willTerminate gives no async window, so wait here (bounded) for the end to reach the system.
  nonisolated static func endAllBlocking() {
    let done = DispatchSemaphore(value: 0)
    Task.detached {
      for a in Activity<IslandAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
      done.signal()
    }
    _ = done.wait(timeout: .now() + 2)
  }

  func start() {
    keeper.start()
    guard loop == nil else { return }
    DiagLog.write("start")
    if activity == nil, let existing = Activity<IslandAttributes>.activities.first(where: { $0.activityState == .active }) {
      adopt(existing)
    }
    loop = Task { [weak self] in
      var polls = 0
      while !Task.isCancelled {
        polls += 1
        // One line a minute, whatever else happens, so a gap in the log dates a suspension.
        if polls % 12 == 1 { self?.logPulse() }
        await self?.tick()
        try? await Task.sleep(nanoseconds: Config.pollSeconds * 1_000_000_000)
      }
    }
  }

  // ActivityKit only lets an app START an activity from the foreground, so a Live Activity that
  // hit its 8-hour limit while we were backgrounded can only come back here, on the next open.
  func foregrounded() {
    DiagLog.write("foregrounded")
    keeper.start()
    let alive = activity?.activityState == .active || activity?.activityState == .stale
    // scenePhase and onAppear can both land here on one launch; without this, two activities
    // were requested and one was immediately dismissed.
    guard !alive, !opening else { return }
    opening = true
    // Open with real counts, not the placeholder: if later updates are dropped by iOS's budget,
    // a placeholder opening would sit at "0 · 0 · 0" for as long as the budget stays spent.
    Task {
      let state = await fetchState() ?? last ?? .calm
      last = state
      request(state)
      opening = false
    }
  }

  // Order matters. The loop must not start before the new activity exists: its first tick
  // would race this one and open a second activity that nothing updates, which greyed and then
  // vanished two minutes after a Shortcuts-triggered restart (2026-09-26). Request first, while
  // still inside the intent's window, then let start() adopt it.
  private func logPulse() {
    let remaining = UIApplication.shared.backgroundTimeRemaining
    let left = remaining > 1e6 ? "inf" : String(Int(remaining))
    DiagLog.write("pulse location=\(keeper.running)/\(keeper.authorization) bgLeft=\(left)s activity=\(activity.map { "\($0.activityState)" } ?? "nil") updates=\(heartbeats)")
  }

  func restart() async {
    DiagLog.write("restart begin, loop=\(loop != nil)")
    for a in Activity<IslandAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
    activity = nil
    let state = await fetchState() ?? last ?? .calm
    last = state
    request(state)
    start()
    DiagLog.write("restart end, activity=\(activity.map { String($0.id.prefix(6)) } ?? "nil")")
  }

  private func fetchState() async -> IslandAttributes.ContentState? {
    guard Config.configuredURL != nil else { return nil }
    var req = URLRequest(url: Config.collieURL.appending(path: "api/snapshot"))
    req.timeoutInterval = 8
    let began = Date()
    // Slow or failed polls are logged because on the home Wi-Fi the phone reached Collie badly
    // while cellular was fine; the log is where that shows up from the phone's side.
    do {
      let (data, resp) = try await URLSession.shared.data(for: req)
      let ms = Int(Date().timeIntervalSince(began) * 1000)
      guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
        DiagLog.write("poll http \((resp as? HTTPURLResponse)?.statusCode ?? -1) in \(ms)ms")
        return nil
      }
      if ms > 2000 { DiagLog.write("poll slow \(ms)ms") }
      guard let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return nil }
      return summarize(snap.agents, showDetail: Config.showDetail)
    } catch {
      let ms = Int(Date().timeIntervalSince(began) * 1000)
      DiagLog.write("poll failed in \(ms)ms: \((error as? URLError)?.code.rawValue ?? -1) \(error.localizedDescription)")
      return nil
    }
  }

  private func tick() async {
    var next: IslandAttributes.ContentState
    if let fetched = await fetchState() {
      next = fetched
      failures = 0
    } else {
      failures += 1
      guard failures >= Config.offlineAfterFailures, var stale = last else { return }
      stale.offline = true
      next = stale
    }
    let sinceSent = Date().timeIntervalSince(lastSent)
    let changed = next != last
    let urgent = changed && next.needs > (last?.needs ?? 0)
    // `last` is the last state SHOWN, so a change held back by the gap is retried next poll.
    guard sinceSent >= Config.heartbeatSeconds || (changed && (urgent || sinceSent >= Config.minUpdateGapSeconds))
    else { return }
    let alert = !next.offline && (next.needs > (last?.needs ?? 0) || next.ready > (last?.ready ?? 0))
    last = next
    await show(next, alert: alert)
  }

  private func show(_ state: IslandAttributes.ContentState, alert: Bool) async {
    // A stale activity is still alive and an update revives it; only ended or dismissed ones
    // need replacing, and ActivityKit refuses that from the background ("visibility"), so there
    // it waits for the next foreground or RestartIslandIntent instead of retrying every poll.
    guard let activity, activity.activityState == .active || activity.activityState == .stale else {
      if UIApplication.shared.applicationState == .active {
        request(state)
      } else if !waitingLogged {
        DiagLog.write("activity gone (\(activity.map { "\($0.activityState)" } ?? "nil")); waiting for foreground or intent")
        waitingLogged = true
      }
      return
    }
    waitingLogged = false
    lastSent = Date()
    heartbeats += 1
    if heartbeats % 10 == 0 { DiagLog.write("alive, \(heartbeats) updates sent") }
    // If iOS kills us without willTerminate (memory pressure, crash), the heartbeat stops and the
    // island turns grey once this date passes, instead of passing old counts off as current.
    let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(Config.staleAfterSeconds))
    if alert {
      let config = AlertConfiguration(
        title: LocalizedStringResource(stringLiteral: state.headline),
        body: LocalizedStringResource(stringLiteral: state.detail),
        sound: .default)
      await activity.update(content, alertConfiguration: config)
    } else {
      await activity.update(content)
    }
  }

  private func request(_ state: IslandAttributes.ContentState) {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      DiagLog.write("request skipped: Live Activities disabled")
      return
    }
    lastSent = Date()
    do {
      // pushType must stay nil: a Personal Team build has no aps-environment entitlement, and
      // asking for a push token then makes the request fail outright (LoopKit/Loop#2532).
      let fresh = try Activity.request(
        attributes: IslandAttributes(),
        content: ActivityContent(state: state, staleDate: Date().addingTimeInterval(Config.staleAfterSeconds)),
        pushType: nil)
      // Strays are ended only once a replacement exists; ending them before a request that then
      // fails (as it does from the background) is what used to wipe the island entirely.
      for stray in Activity<IslandAttributes>.activities where stray.id != fresh.id {
        Task { await stray.end(nil, dismissalPolicy: .immediate) }
      }
      adopt(fresh)
      DiagLog.write("request ok \(fresh.id.prefix(6))")
    } catch {
      DiagLog.write("request failed: \(error)")
    }
  }

  private func adopt(_ a: Activity<IslandAttributes>) {
    activity = a
    Task {
      for await s in a.activityStateUpdates { DiagLog.write("activity \(a.id.prefix(6)) -> \(s)") }
    }
  }
}
