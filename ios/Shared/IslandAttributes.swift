import ActivityKit
import Foundation

struct IslandAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var needs: Int
    var ready: Int
    var working: Int
    var headline: String
    var detail: String
    var paneId: String?
    var bucket: Bucket
    // Set when Collie has been unreachable long enough that the counts above may be wrong;
    // without it the island keeps showing the last good numbers as if they were live.
    var offline: Bool
    // Set when Collie answered but refused this app's reads (pairing is required from Collie
    // 1.18.0). The counts are then meaningless, and a tap opens the pair form instead of a pane.
    // Optional with a default so an activity started by an older build still decodes.
    var pairing: PairingIssue? = nil

    static let calm = ContentState(
      needs: 0, ready: 0, working: 0, headline: "Gaddi", detail: "", paneId: nil, bucket: .recent,
      offline: false)
  }
}

/// Why Collie refused the island's reads, told apart so the island can say what to do.
enum PairingIssue: String, Codable, Hashable {
  /// This app has never been paired with this Collie.
  case unpaired
  /// It was paired, and Collie no longer knows the token: revoked, or the host's pairings reset.
  case revoked
  /// It was paired with an expiry, and that date has passed.
  case expired
}

enum Deeplink {
  static let scheme = "collieisland"
  /// Opens Collie's pair form inside the app (web/src/lib/nav.ts `pairLandingPath`'s target).
  static let pairURL = URL(string: "collieisland://pair")!

  static func isPair(_ url: URL) -> Bool { url.scheme == scheme && url.host == "pair" }

  static func url(paneId: String?) -> URL {
    var c = URLComponents()
    c.scheme = scheme
    c.host = "open"
    if let paneId { c.queryItems = [URLQueryItem(name: "pane", value: paneId)] }
    return c.url!
  }

  static func paneId(from url: URL) -> String? {
    guard url.scheme == scheme else { return nil }
    return URLComponents(url: url, resolvingAgainstBaseURL: false)?
      .queryItems?.first(where: { $0.name == "pane" })?.value
  }
}
