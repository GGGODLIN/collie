import ActivityKit
import SwiftUI
import WidgetKit

@main
struct IslandWidgetBundle: WidgetBundle {
  var body: some Widget {
    IslandLiveActivity()
    RestartIslandControl()
  }
}

struct RestartIslandControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    // A kind only has to be unique inside this app, so any build can keep it. Renaming it would
    // drop the button from every Control Center it has already been added to.
    StaticControlConfiguration(kind: "com.gggodlin.collieisland.restart") {
      ControlWidgetButton(action: RestartIslandIntent()) {
        Label("重啟靈動島", systemImage: "pawprint.fill")
      }
    }
    .displayName("重啟 Collie 靈動島")
  }
}

struct IslandLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: IslandAttributes.self) { context in
      LockScreenView(state: context.state, stale: context.isStale)
        .padding()
        .widgetURL(Deeplink.url(paneId: context.state.paneId))
    } dynamicIsland: { context in
      let s = context.state
      let stale = context.isStale
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          StatusMark(state: s, stale: stale, size: 30).padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(countsLine(s, stale: stale)).font(.caption).foregroundStyle(.secondary)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 2) {
            Text(s.headline).font(.headline).lineLimit(1)
            if !s.detail.isEmpty {
              Text(s.detail).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      } compactLeading: {
        StatusMark(state: s, stale: stale, size: 18)
      } compactTrailing: {
        Text(compactLabel(s, stale: stale)).font(.caption2).monospacedDigit()
      } minimal: {
        StatusMark(state: s, stale: stale, size: 18)
      }
      .widgetURL(Deeplink.url(paneId: s.paneId))
    }
  }
}

struct LockScreenView: View {
  let state: IslandAttributes.ContentState
  let stale: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 10) {
      StatusMark(state: state, stale: stale, size: 30)
      VStack(alignment: .leading, spacing: 2) {
        Text(state.headline).font(.headline).lineLimit(1)
        if !state.detail.isEmpty {
          Text(state.detail).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
        }
        Text(countsLine(state, stale: stale)).font(.caption).foregroundStyle(.secondary)
      }
      Spacer(minLength: 0)
    }
  }
}

// Collie's own mark, tinted by the most urgent bucket, so the island reads as Collie at a glance
// and still carries the colour the old status dot did.
struct StatusMark: View {
  let state: IslandAttributes.ContentState
  let stale: Bool
  let size: CGFloat

  var body: some View {
    Image("CollieMark")
      .resizable()
      .renderingMode(.template)
      .scaledToFit()
      .foregroundStyle(markColor(state, stale: stale))
      .frame(width: size, height: size)
  }
}

private func markColor(_ s: IslandAttributes.ContentState, stale: Bool) -> Color {
  if s.offline || stale { return .gray }
  switch s.bucket {
  case .needs: return .red
  case .ready: return .green
  case .working: return .blue
  case .recent: return .gray
  }
}

private func compactLabel(_ s: IslandAttributes.ContentState, stale: Bool) -> String {
  if stale { return "已停止" }
  if s.offline { return "離線" }
  if s.needs > 0 { return "\(s.needs) 等你" }
  if s.ready > 0 { return "\(s.ready) 完成" }
  if s.working > 0 { return "\(s.working) 工作中" }
  return "—"
}

private func countsLine(_ s: IslandAttributes.ContentState, stale: Bool) -> String {
  if stale { return "Collie app 已停止更新" }
  if s.offline { return "連不到 Collie" }
  return "等你 \(s.needs) · 完成 \(s.ready) · 工作中 \(s.working)"
}
