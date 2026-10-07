# upstream-1.17-adaptation/v2

本次同步保留上游新介面與 fork 補丁。只有入口、控制或重要前置改變的案例採 v2；純 Dashboard 定位更新不改案例版本。

## 核定範圍與來源

本次同步的 main 原樣轉達契約更新問題與建議後，使用者回覆「看起來還好」。main 將它解讀為同意：測試適應上游 ADR 0082／0083／0085；重要動作或期待改變另立版本；原快照與原失敗證據保留；不改產品來恢復舊介面。這是本方案的核定，不是使用者逐案審讀的聲明。

- [ADR 0082](/.adr/0082-chat-is-the-default-view-of-an-agent-pane.md) Decision 1–4：Chat 預設開啟，不再由 Experiments opt-in；既有 Terminal 選擇仍保存。
- [ADR 0085](/.adr/0085-the-dashboards-tabs-are-dashboard-crew-and-changes.md) Decision 1–3、8 與 Files amendment：Dashboard 取代 Panes，needs-you 開關取代 Focus tab；過濾不排序，整個 workspace 的計數保持；Files 仍列 workspace 的變更。
- [ADR 0083](/.adr/0083-the-files-view-reads-the-changes-root.md) Files screen amendment：All files 預設，Changes segment 顯示既有變更清單，Tree 是單一 toggle。
- [原 Full reply 快照](/web/e2e/tester-army/contracts/supplemental-web.v1.md)：保留 prompt／reply 配對、tail identity、鏡像不重複、reply 後的尾列與缺 prompt／identity miss 負例。
- [原執行脈絡](/web/e2e/tester-army/contract.md)與[涵蓋表](/web/e2e/tester-army/coverage.md)繼續記錄本套的邊界。

## 原版保存

原 contracts/*.v1.md 與 title-dash.v3.md 不改。舊 sweep 的來源與結果仍在 runs/；本次原案實跑保存為 upstream-sync-1.17.2-original，沒有覆寫或把失敗改成預期失敗。

v2 的清單只取下面明列的案例，不從新版實跑結果反填期待。其餘案例保留原語義與資料；Dashboard 的名稱換成字典中 home.tabs.dashboard 是定位修正。

## 共同前置與邊界

真 Chromium phone、隔離正式 web build、fresh context、en locale，API 與 pane／journal 資料沿用 repo 原 fixture。service worker 阻擋，telemetry 關閉，沒有模型、cache replay、live bridge、Herdr socket、sidecar 或原生 iOS。

新增 Terminal 前置只寫本案例 context 的 paneView=terminal，保留既有 device 偏好。它不模擬 full-reply matcher、不繞過實際產品 render、不改 snapshot、journal 或 mirror 輸入。

## v2 案例

| ID／版本 | 操作與可觀察期待 | 保持的原檢查 |
| --- | --- | --- |
| DASH-FOOT/tabs/v2 | solo footer 恰為 Dashboard／Files；Dashboard 為 current、needs-you 起初 off；開啟後仍在 Dashboard，顯示 urgent pane；Files 為 current 且不畫 needs-you 開關 | 原兩個 workspace 的順序、各五個變更檔與 +10 −2 totals |
| DASH-FOOT/focus-filter/v2 | Dashboard 的 needs-you 開關代替 Focus tab，aria-pressed 變 true | workspace 順序不變；working-only workspace 從 body 消失，仍留在 workspace strip |
| DASH-FOOT/focus-order/v2 | 同一開關套用原 focusFilterOrderAgents 輸入 | ws1 先於 ws3；ws3 的 unseen done pane 先於後面的 blocked pane；ws2 缺席 |
| CHG-LIST/pane/v2 | pane 的 Files belt 開 Files；All files 起初 selected，選 Changes，Tree toggle 為 false | 原 checkout.tsx 的 Modified、+3、−1；沒有 Stage／Commit／Check out 控制；API writes 為空 |
| CHG-LIST/dashboard/v2 | footer Files 開原 workspace 變更清單，webapp 開原 /space/w1/changes；選 Changes segment | 原 checkout.tsx 的 Modified、+3、−1；API writes 為空 |
| SET-CHAT/default/v2 | Settings index 沒有 Experiments；fresh device 的 pane menu 有 Terminal view，沒有 Chat view | 不用 fake opt-in；只驗選擇介面，不冒稱 fixture 有 live transcript |
| SET-CHAT/reload/v2 | 從 pane menu 選 Terminal；reload 後有 Chat view、沒有 Terminal view；選 Chat 再 reload 後反向成立 | 只由真 UI 修改 device 選擇；不重開 browser context、不改 API fixture |
| ACCT-DRAFT/refuse/v2 | 原 idle／hasSession／Personal 及 canonical 409，明示 Terminal 前置，保留 Find 正向檢查 | 一個 account POST、interrupt=false、原拒絕文字、沒有成功句與 keys／reply POST |
| RETELL-ON/lost/v2 | 原 configured retell 與 finished answer，明示 Terminal 前置，保留 Find 正向檢查 | Plain／Lost 都可見、Lost 原 answer 與 cached 提示、單一 mode=lost／fresh=false POST |
| RETELL-ON/plain-broken/v2 | 原 configured retell 與 failed reason，明示 Terminal 前置，保留 Find 正向檢查 | Plain／Lost 都可見、原失敗理由、單一 mode=plain／fresh=false POST |
| full-reply-paired/v2 | 原 v1 輸入，明示 Terminal 前置 | Full reply、原 prompt／reply、tail 恰一次、原 AFTER 列 |
| full-reply-no-prompt/v2 | 原 v1 無 user turn 輸入，明示 Terminal 前置 | 沒有 card，tail 與 AFTER 都仍在鏡像；不存在的 head 仍不存在 |
| full-reply-identity-miss/v2 | 原 v1 的不同畫面輸入，明示 Terminal 前置 | 原不同畫面可見，沒有 Full reply card |
| REPLY-PAINT/wrapped-table/v2 | 原 source／painted table／prompt／AFTER，明示 Terminal 前置 | 原格子可見、結語恰一次、原尾列保留、沒有 keys POST |

## 映射與未驗

- Footer／filter：loop-navigation-keys.e2e.ts。
- Files 清單：loop-changes-idle.e2e.ts。
- Chat device 選擇：loop-language-preferences.e2e.ts。
- Terminal full-reply：supplemental-web.e2e.ts、loop-reply-typeface.e2e.ts；帳號拒絕與 retell：loop-account-retell-launch.e2e.ts。前置共用 fixtures.ts 的 pinTerminalView。
- palette、bar、attention 排序／freeze、description、retell、account refusal、Keys、語言、Theme、Typeface、idle 等原期待不改。

fixture 回覆只證明真網頁的行為與請求，不證明 bridge 實際讀 journal／recap、sidecar 執行、terminal 收到 keys、Windows、Safari 或原生 iOS。原涵蓋表的未驗分支仍未驗。
