import Foundation
import Security
import WebKit

// A copy of Collie's localStorage (settings and the pairing token, collie:device-token) kept in
// the Keychain, because WebKit can lose the web view's own storage: after a reboot the app was
// relaunched before the first unlock and the page came up empty, pairing and all (2026-09-27).
//
// Restore only fires when the page's storage holds no collie: keys at all; restoring key by key
// would resurrect whatever Collie itself removed (an unpaired token, a reset setting). The
// restore script embeds the backup, so it is rebuilt on every save: built once at view creation
// it restored an empty pre-pairing snapshot after a wipe, and the capture that followed then
// overwrote the good backup (2026-09-27 debug-wipe test).
enum WebStateBackup {
  static let handlerName = "collieBackup"
  static let restoredName = "collieRestored"
  static let wipeNotification = Notification.Name("CollieIslandDebugWipe")
  private static let service = "\(Bundle.main.bundleIdentifier ?? "collieisland").webstate"
  private static let account = "localStorage"

  static func load() -> [String: String] {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
    ]
    var out: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data,
      let dict = try? JSONDecoder().decode([String: String].self, from: data)
    else { return [:] }
    return dict
  }

  static func save(_ state: [String: String]) {
    guard let data = try? JSONEncoder().encode(state) else { return }
    let match: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    let update: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]
    if SecItemUpdate(match as CFDictionary, update as CFDictionary) == errSecItemNotFound {
      SecItemAdd(match.merging(update) { $1 } as CFDictionary, nil)
    }
  }

  static func install(on controller: WKUserContentController, handler: WKScriptMessageHandler) {
    setScripts(on: controller, saved: load())
    controller.add(handler, name: handlerName)
    controller.add(handler, name: restoredName)
  }

  static func setScripts(on controller: WKUserContentController, saved state: [String: String]) {
    let origin = Config.collieURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let saved = (try? JSONEncoder().encode(state)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
    let originJSON = (try? JSONEncoder().encode(origin)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""

    let restore = """
      (function () {
        if (location.origin !== \(originJSON)) return;
        try {
          for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i).startsWith("collie:")) return;
          }
          const saved = \(saved);
          let n = 0;
          for (const k in saved) { localStorage.setItem(k, saved[k]); n++; }
          window.webkit.messageHandlers.\(restoredName).postMessage({ keys: n, token: "collie:device-token" in saved });
        } catch (e) {}
      })();
      """

    // Drafts and the snapshot cache are large and churn constantly; losing them is harmless.
    let capture = """
      (function () {
        if (location.origin !== \(originJSON)) return;
        const keep = (k) => k.startsWith("collie:") && !k.startsWith("collie:draft:")
          && !k.startsWith("collie:last-snapshot:") && k !== "collie:test";
        let timer = null;
        const send = () => {
          timer = null;
          const out = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (keep(k)) out[k] = localStorage.getItem(k);
          }
          window.webkit.messageHandlers.\(handlerName).postMessage(out);
        };
        const schedule = () => { if (!timer) timer = setTimeout(send, 500); };
        const proto = Storage.prototype;
        for (const name of ["setItem", "removeItem", "clear"]) {
          const original = proto[name];
          proto[name] = function () {
            const result = original.apply(this, arguments);
            if (this === window.localStorage) schedule();
            return result;
          };
        }
        addEventListener("load", schedule);
        document.addEventListener("visibilitychange", schedule);
      })();
      """

    controller.removeAllUserScripts()
    controller.addUserScript(WKUserScript(source: restore, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    controller.addUserScript(WKUserScript(source: capture, injectionTime: .atDocumentStart, forMainFrameOnly: true))
  }
}

final class WebStateBackupHandler: NSObject, WKScriptMessageHandler {
  private var last: [String: String]?

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.frameInfo.securityOrigin.host == Config.collieURL.host,
      let body = message.body as? [String: Any]
    else { return }
    if message.name == WebStateBackup.restoredName {
      let token = (body["token"] as? Bool) ?? false
      MainActor.assumeIsolated { DiagLog.write("web state restored from Keychain: \(body["keys"] ?? "?") keys, token=\(token)") }
      return
    }
    guard message.name == WebStateBackup.handlerName else { return }
    let state = body.compactMapValues { $0 as? String }
    guard state != last else { return }
    last = state
    WebStateBackup.save(state)
    WebStateBackup.setScripts(on: controller, saved: state)
    let token = state["collie:device-token"] != nil
    MainActor.assumeIsolated { DiagLog.write("web state backed up: \(state.count) keys, token=\(token)") }
  }
}
