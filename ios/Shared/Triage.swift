import Foundation

struct Snapshot: Decodable {
  let agents: [Agent]
}

struct Agent: Decodable {
  let paneId: String
  let kind: String?
  let status: String
  let workspaceLabel: String?
  let terminalTitle: String?
  let lastActiveAt: Double?
  let lastSeenAt: Double?
  let description: Description?

  struct Description: Decodable {
    let now: String?
  }
}

// Raw values order urgency; the names match Collie's TriageKey so the two can be compared by eye.
enum Bucket: Int, Codable, Hashable, Comparable {
  case needs = 0, ready, working, recent

  static func < (a: Bucket, b: Bucket) -> Bool { a.rawValue < b.rawValue }
}

// Mirrors bucketOf / isUnseen in collie web/src/lib/triage.ts. If the island and the app's
// "Needs you" list ever disagree, this is the copy that drifted.
func bucket(of a: Agent) -> Bucket {
  if a.status == "blocked" { return .needs }
  let settled = a.status == "done" || a.status == "idle"
  if a.kind != "shell" && settled && (a.lastActiveAt ?? 0) > (a.lastSeenAt ?? 0) { return .ready }
  if a.status == "working" { return .working }
  return .recent
}

func summarize(_ agents: [Agent]) -> IslandAttributes.ContentState {
  let tagged = agents.map { (agent: $0, bucket: bucket(of: $0)) }
  let count = { (b: Bucket) in tagged.filter { $0.bucket == b }.count }
  let top = tagged
    .filter { $0.bucket != .recent }
    .min { l, r in
      l.bucket != r.bucket ? l.bucket < r.bucket : (l.agent.lastActiveAt ?? 0) > (r.agent.lastActiveAt ?? 0)
    }
  let title = top.map { $0.agent.terminalTitle ?? $0.agent.workspaceLabel ?? $0.agent.paneId }
  return IslandAttributes.ContentState(
    needs: count(.needs),
    ready: count(.ready),
    working: count(.working),
    headline: title ?? "Collie",
    detail: top?.agent.description?.now ?? "",
    paneId: top?.agent.paneId,
    bucket: top?.bucket ?? .recent,
    offline: false)
}
