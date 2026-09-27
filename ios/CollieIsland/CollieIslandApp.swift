import SwiftUI

@main
struct CollieIslandApp: App {
  private let monitor = Monitor.shared
  @State private var navigation = Navigation(url: Config.collieURL, seq: 0)
  @Environment(\.scenePhase) private var phase
  // "Always" location lets iOS relaunch us in the background right after a reboot, before the
  // first unlock. A WKWebView created then cannot read its encrypted website data and came up
  // empty, which wiped Collie's pairing and settings (2026-09-27). So the web view is only built
  // once protected data is available and the app has been in the foreground.
  @State private var webReady = false
  // Any app can open collieisland://debug-wipe, and iOS's own prompt only asks whether to open Collie,
  // so the wipe waits for a confirmation that says what it destroys.
  @State private var confirmWipe = false

  var body: some Scene {
    WindowGroup {
      Group {
        if Config.configuredURL == nil {
          Text("COLLIE_URL is not set. Put your Collie's address in ios/Config.local.xcconfig and build again.")
            .multilineTextAlignment(.center)
            .padding()
        } else if webReady {
          WebView(navigation: navigation)
        } else {
          Color(.systemBackground)
        }
      }
        // Full-bleed put Collie's header under the status bar and the island: inside a
        // WKWebView its env(safe-area-inset-top) came through as 0. The keyboard stays ignored
        // because WKWebView already resizes for it; SwiftUI shrinking the view too doubles it.
        .ignoresSafeArea(.keyboard)
        .onAppear { monitor.start() }
        .onOpenURL { open($0) }
        .onChange(of: phase) { _, now in
          guard now == .active else { return }
          monitor.foregrounded()
          if UIApplication.shared.isProtectedDataAvailable { webReady = true }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.protectedDataDidBecomeAvailableNotification)) { _ in
          if phase == .active { webReady = true }
        }
        .alert("清除 app 裡的網頁資料？", isPresented: $confirmWipe) {
          Button("清除", role: .destructive) {
            DiagLog.write("debug-wipe confirmed")
            NotificationCenter.default.post(name: WebStateBackup.wipeNotification, object: nil)
          }
          Button("取消", role: .cancel) { DiagLog.write("debug-wipe cancelled") }
        } message: {
          Text("這是測試備份用的連結。未送出的草稿會被刪掉，設定和配對會從 Keychain 還原。")
        }
    }
  }

  private func open(_ link: URL) {
    if link.scheme == Deeplink.scheme && link.host == "debug-wipe" {
      DiagLog.write("debug-wipe requested; asking first")
      confirmWipe = true
      return
    }
    var target = Config.collieURL
    if let pane = Deeplink.paneId(from: link) {
      // Same encoding as Collie's paneHref (web/src/lib/nav.ts): encodeURIComponent on the id.
      let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_.!~*'()"))
      let encoded = pane.addingPercentEncoding(withAllowedCharacters: allowed) ?? pane
      target = URL(string: Config.collieURL.absoluteString + "/pane/" + encoded) ?? target
    }
    navigation = Navigation(url: target, seq: navigation.seq + 1)
  }
}
