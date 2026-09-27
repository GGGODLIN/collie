import Foundation

enum Config {
  // The tailnet front door `tailscale serve` publishes for the active Collie. The phone must be on
  // the tailnet; the front door adds the identity header Collie's trusted-user gate requires.
  // COLLIE_URL in Config.local.xcconfig reaches it through Info.plist's CollieURL.
  static let configuredURL: URL? = {
    guard let raw = Bundle.main.object(forInfoDictionaryKey: "CollieURL") as? String,
          let url = URL(string: raw.trimmingCharacters(in: .whitespaces)),
          url.scheme == "https" || url.scheme == "http", url.host != nil
    else { return nil }
    return url
  }()
  // A placeholder while COLLIE_URL is missing: nothing is fetched then, and the app says why.
  static let collieURL = configuredURL ?? URL(string: "about:blank")!
  static let pollSeconds: UInt64 = 5
  // Failed polls in a row before the island admits it is showing stale numbers.
  static let offlineAfterFailures = 6
  // Re-send the unchanged state this often so the stale date keeps moving while we are alive.
  // Update pacing, still being measured. At one update every 5 s under the silent-audio keeper the
  // activity froze after ~2.5 min; that turned out to be liveactivitiesd refusing a process that
  // only plays background media, not a pure rate limit. Apple still throttles frequent updates, so
  // content goes out at most every 30 s (a newly blocked agent at once) and a 60 s heartbeat
  // greys the island within ~3-4 min if updates stop landing.
  static let minUpdateGapSeconds: TimeInterval = 30
  static let heartbeatSeconds: TimeInterval = 60
  static let staleAfterSeconds: TimeInterval = 180
}
