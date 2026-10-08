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

    static let calm = ContentState(
      needs: 0, ready: 0, working: 0, headline: "Gaddi", detail: "", paneId: nil, bucket: .recent,
      offline: false)
  }
}

enum Deeplink {
  static let scheme = "collieisland"

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
