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
  var onOpenAddress: () -> Void = {}
  var onLoadFailed: (String) -> Void = { _ in }
  var onLoaded: () -> Void = {}

  func makeCoordinator() -> Coordinator { Coordinator() }

  func makeUIView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    WebStateBackup.install(on: config.userContentController, handler: context.coordinator.backup)
    config.userContentController.add(context.coordinator.address, name: IslandAddress.handlerName)
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    let view = WKWebView(frame: .zero, configuration: config)
    view.uiDelegate = context.coordinator
    view.navigationDelegate = context.coordinator
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
    context.coordinator.address.onOpen = onOpenAddress
    context.coordinator.onLoadFailed = onLoadFailed
    context.coordinator.onLoaded = onLoaded
    guard context.coordinator.loaded != navigation else { return }
    context.coordinator.loaded = navigation
    view.load(URLRequest(url: navigation.url))
  }

  final class Coordinator: NSObject, WKUIDelegate, WKNavigationDelegate {
    var loaded: Navigation?
    let backup = WebStateBackupHandler()
    let address = IslandAddressHandler()
    var onLoadFailed: (String) -> Void = { _ in }
    var onLoaded: () -> Void = {}
    weak var view: WKWebView?

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
      failed(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
      failed(error)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      onLoaded()
    }

    // A load cut short by the next one (a pane link tapped mid-load) is not Collie being down.
    private func failed(_ error: Error) {
      if (error as NSError).code == NSURLErrorCancelled { return }
      MainActor.assumeIsolated { DiagLog.write("page load failed: \(error.localizedDescription)") }
      onLoadFailed(error.localizedDescription)
    }

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
