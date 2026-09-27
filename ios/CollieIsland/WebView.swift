import SwiftUI
import WebKit

struct Navigation: Equatable {
  var url: URL
  // Bumped on every request so tapping the island for the same pane twice still navigates,
  // even after the user has wandered off inside Collie.
  var seq: Int
}

struct WebView: UIViewRepresentable {
  let navigation: Navigation

  func makeCoordinator() -> Coordinator { Coordinator() }

  func makeUIView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    WebStateBackup.install(on: config.userContentController, handler: context.coordinator.backup)
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    let view = WKWebView(frame: .zero, configuration: config)
    view.uiDelegate = context.coordinator
    view.isInspectable = true
    view.scrollView.contentInsetAdjustmentBehavior = .never
    view.isOpaque = false
    view.backgroundColor = .systemBackground
    context.coordinator.view = view
    // Test hook for the Keychain restore: collieisland://debug-wipe empties the page's storage
    // the way a pre-unlock launch did, then reloads so the restore script has to put it back.
    NotificationCenter.default.addObserver(forName: WebStateBackup.wipeNotification, object: nil, queue: .main) {
      [weak view] _ in
      WKWebsiteDataStore.default().removeData(
        ofTypes: [WKWebsiteDataTypeLocalStorage], modifiedSince: .distantPast
      ) { view?.reload() }
    }
    return view
  }

  func updateUIView(_ view: WKWebView, context: Context) {
    guard context.coordinator.loaded != navigation else { return }
    context.coordinator.loaded = navigation
    view.load(URLRequest(url: navigation.url))
  }

  final class Coordinator: NSObject, WKUIDelegate {
    var loaded: Navigation?
    let backup = WebStateBackupHandler()
    weak var view: WKWebView?

    // Collie's composer records voice through getUserMedia; without this WebKit asks on every
    // single recording. The only page this view ever loads is the operator's own Collie.
    func webView(
      _ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
      initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
      decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
      decisionHandler(Config.isCollie(scheme: origin.protocol, host: origin.host, port: origin.port) ? .grant : .prompt)
    }
  }
}
