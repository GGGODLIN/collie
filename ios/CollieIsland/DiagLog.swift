import Foundation
import UIKit

// A plain-text trail of what the island did, in the app's Documents, pulled from the Mac with
// `devicectl device copy from --domain-type appDataContainer`. It exists because the failures
// worth chasing (a background launch, a silent suspension) happen with no debugger attached and
// reading the phone's system log needs root on the Mac.
enum DiagLog {
  private static let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    .appendingPathComponent("island.log")
  private static let maxBytes = 256 * 1024
  private static let stamp: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.timeZone = .current
    return f
  }()

  @MainActor
  static func write(_ message: String) {
    let state: String
    switch UIApplication.shared.applicationState {
    case .active: state = "fg"
    case .inactive: state = "inactive"
    case .background: state = "bg"
    @unknown default: state = "?"
    }
    let line = "\(stamp.string(from: Date())) [\(state)] \(message)\n"
    guard let data = line.data(using: .utf8) else { return }
    if let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size]) as? Int,
      size > maxBytes
    {
      try? FileManager.default.removeItem(at: url)
    }
    if let handle = try? FileHandle(forWritingTo: url) {
      handle.seekToEndOfFile()
      handle.write(data)
      try? handle.close()
    } else {
      try? data.write(to: url)
    }
  }
}
