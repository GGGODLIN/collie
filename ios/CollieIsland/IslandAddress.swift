import SwiftUI
import WebKit

// The Collie address as the operator typed it into the app. A prebuilt .ipa has no COLLIE_URL
// compiled in, so without this it could only ever say "not set".
enum IslandAddress {
  private static let key = "collieURL"
  static let handlerName = "collieIslandAddress"

  static var saved: URL? { Config.parse(UserDefaults.standard.string(forKey: key)) }

  static func save(_ url: URL) {
    UserDefaults.standard.set(url.absoluteString, forKey: key)
  }

  enum CheckError: Error {
    case invalid
    case unreachable(String)
    case notCollie(Int)

    var message: String {
      switch self {
      case .invalid:
        return "這不是網址。格式像 https://your-mac.your-tailnet.ts.net:8443"
      case .unreachable(let why):
        // The system's reason already ends in its own full stop ("…to the server.").
        let reason = why.trimmingCharacters(in: CharacterSet(charactersIn: ".。 "))
        return "連不上：\(reason)。手機要在 Collie 那台機器的 tailnet 上。"
      case .notCollie(let status):
        return status == 200
          ? "有回應，但不是 Collie。"
          : "有回應，但沒有拿到 Collie 的資料（HTTP \(status)）。"
      }
    }
  }

  /// Saves nothing: the caller saves only what passed, so a typo never replaces a working address.
  /// /api/snapshot is the read the island polls, and decoding it is what tells Collie apart from
  /// some other page at that address.
  static func check(_ raw: String) async -> Result<URL, CheckError> {
    guard let url = Config.parse(raw) else { return .failure(.invalid) }
    var req = URLRequest(url: url.appending(path: "api/snapshot"))
    req.timeoutInterval = 8
    do {
      let (data, resp) = try await URLSession.shared.data(for: req)
      let status = (resp as? HTTPURLResponse)?.statusCode ?? -1
      guard status == 200, (try? JSONDecoder().decode(Snapshot.self, from: data)) != nil else {
        return .failure(.notCollie(status))
      }
      return .success(url)
    } catch {
      return .failure(.unreachable(error.localizedDescription))
    }
  }

  /// `window.collieIsland.openAddress()` for Collie's settings page
  /// (web/src/components/island-address-control.tsx). It only opens the native screen: the page
  /// never hands over an address, so script in the page cannot point the app at another server.
  static func bridgeScript() -> WKUserScript {
    // Spelled the way the page's `location.origin` is: no path, and no port when it is the default.
    let url = Config.collieURL
    let defaultPort = url.scheme == "https" ? 443 : 80
    let port = url.port.map { $0 == defaultPort ? "" : ":\($0)" } ?? ""
    let origin = "\(url.scheme ?? "https")://\(url.host?.lowercased() ?? "")\(port)"
    let originJSON = (try? JSONEncoder().encode(origin)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
    let source = """
      (function () {
        if (location.origin !== \(originJSON)) return;
        window.collieIsland = Object.freeze({
          openAddress: function () { window.webkit.messageHandlers.\(handlerName).postMessage({}); },
        });
      })();
      """
    return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
  }
}

final class IslandAddressHandler: NSObject, WKScriptMessageHandler {
  var onOpen: () -> Void = {}

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    let origin = message.frameInfo.securityOrigin
    guard message.name == IslandAddress.handlerName, message.frameInfo.isMainFrame,
      Config.isCollie(scheme: origin.protocol, host: origin.host, port: origin.port)
    else { return }
    onOpen()
  }
}

struct AddressSetupView: View {
  let current: URL?
  let onSaved: (URL) -> Void
  // nil on first open: there is nothing to go back to yet.
  let onCancel: (() -> Void)?

  @State private var text = ""
  @State private var checking = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("https://your-mac.your-tailnet.ts.net:8443", text: $text)
            .keyboardType(.URL)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .submitLabel(.go)
            .onSubmit(submit)
            .disabled(checking)
        } header: {
          Text("Collie 位址")
        } footer: {
          Text("輸入 `collie start` 印出的網址。儲存前會先連一次，確認是 Collie。換成另一台 Collie 要在那邊重新配對。")
        }
        if let error {
          Section { Text(error).foregroundStyle(.red) }
        }
        Section {
          Button(action: submit) {
            HStack {
              Text(checking ? "連線中…" : "連線並儲存")
              if checking { Spacer(); ProgressView() }
            }
          }
          .disabled(checking || text.trimmingCharacters(in: .whitespaces).isEmpty)
        }
      }
      .navigationTitle("Collie Island")
      .toolbar {
        if let onCancel {
          ToolbarItem(placement: .cancellationAction) { Button("取消", action: onCancel) }
        }
      }
    }
    .onAppear { if text.isEmpty { text = current?.absoluteString ?? "" } }
  }

  private func submit() {
    guard !checking else { return }
    checking = true
    error = nil
    Task {
      let result = await IslandAddress.check(text)
      checking = false
      switch result {
      case .success(let url):
        DiagLog.write("address saved \(url.host ?? "?")")
        onSaved(url)
      case .failure(let why):
        error = why.message
      }
    }
  }
}

// Shown over the web view when Collie's page itself does not load, the moment an address that
// used to work stops working (another machine, a renamed tailnet).
struct LoadFailedView: View {
  let address: URL
  let reason: String
  let onRetry: () -> Void
  let onChange: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      Image(systemName: "wifi.exclamationmark").font(.largeTitle).foregroundStyle(.secondary)
      Text("連不上 Collie").font(.headline)
      Text(address.absoluteString).font(.footnote.monospaced()).foregroundStyle(.secondary)
      Text(reason).font(.footnote).multilineTextAlignment(.center).foregroundStyle(.secondary)
      HStack(spacing: 12) {
        Button("重試", action: onRetry).buttonStyle(.bordered)
        Button("改網址", action: onChange).buttonStyle(.borderedProminent)
      }
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(.systemBackground))
  }
}
