import AppIntents

struct CollieShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: RestartIslandIntent(),
      phrases: ["重啟 \(.applicationName) 靈動島"],
      shortTitle: "重啟靈動島",
      systemImageName: "pawprint.fill")
  }
}
