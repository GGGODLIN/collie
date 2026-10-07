import Foundation

enum Config {
  // The Collie this app opens, usually the tailnet front door `tailscale serve` publishes. The phone must be on
  // the tailnet; the front door adds the identity header Collie's trusted-user gate requires.
  // The address typed into the app wins; COLLIE_URL from Config.local.xcconfig (through
  // Info.plist's CollieURL) is the fallback, so a build made with one keeps opening straight in.
  // A prebuilt .ipa carries no COLLIE_URL and asks on first open (IslandAddress.swift).
  static var configuredURL: URL? { IslandAddress.saved ?? builtInURL }
  static let builtInURL = parse(Bundle.main.object(forInfoDictionaryKey: "CollieURL") as? String)
  // A placeholder while no address is known: nothing is fetched then, and the app asks for one.
  static var collieURL: URL { configuredURL ?? URL(string: "about:blank")! }

  /// An address as a person types it: a missing scheme means https, and a trailing slash is
  /// dropped because pane links are built by appending "/pane/<id>".
  static func parse(_ raw: String?) -> URL? {
    guard var text = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
    if !text.contains("://") { text = "https://" + text }
    while text.hasSuffix("/") { text.removeLast() }
    guard let url = URL(string: text), url.scheme == "https" || url.scheme == "http", url.host != nil
    else { return nil }
    return url
  }
  // ISLAND_SHOW_DETAIL: whether the island and lock screen show what the pane is doing, which can be
  // the newest prompt word for word. Off unless the build says YES.
  static let showDetail = (Bundle.main.object(forInfoDictionaryKey: "CollieShowDetail") as? String) == "YES"

  /// The configured Collie as one origin, `scheme://host:port`, with the scheme's default port filled
  /// in so an explicit `:443` and a bare https URL name the same place.
  static var collieOrigin: String? {
    guard let url = configuredURL, let scheme = url.scheme, let host = url.host else { return nil }
    return "\(scheme)://\(host):\(url.port ?? (scheme == "https" ? 443 : 80))"
  }

  /// Whether a WebKit origin is exactly the configured Collie: scheme, host AND port. A host match
  /// alone would trust another service on the same machine.
  static func isCollie(scheme: String, host: String, port: Int) -> Bool {
    let effective = port != 0 ? port : (scheme == "https" ? 443 : 80)
    return collieOrigin == "\(scheme)://\(host):\(effective)"
  }
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
