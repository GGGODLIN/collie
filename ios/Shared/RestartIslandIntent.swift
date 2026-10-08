import AppIntents

// LiveActivityIntent is the one door ActivityKit leaves open for starting a Live Activity while
// the app is in the background, which is how the island comes back after its 8-hour limit
// without opening the app. The system runs it in the app's process, so the work lives there;
// the widget extension only needs the type so its Control Center button can name it.
struct RestartIslandIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "重啟靈動島"
  static let description = IntentDescription("重新開啟 Gaddi 的靈動島，並繼續更新。")

  func perform() async throws -> some IntentResult {
    #if !WIDGET_EXTENSION
      await Monitor.shared.restart()
    #endif
    return .result()
  }
}
