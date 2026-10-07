# 上游 v1.17.2 同步後的契約重跑

本次依核准的上游介面適應方案更新測試，不改產品來恢復舊介面。原版與失敗紀錄保留；這份記錄不把 API stub 通過當成真 bridge／terminal 已驗。

## 版本與前置

- 原範圍：既有 config 的 `*.e2e.ts`，原案實跑選取 69 案；原始分母取自更新前的 report，而不是新版成功清單。
- 原快照：[contract.md](/web/e2e/tester-army/contract.md)、contracts/ 的原 v1 與 title v3，均保留。
- 更新快照：[upstream-1.17-adaptation/v2](/web/e2e/tester-army/contracts/upstream-1.17-adaptation.v2.md)。14 案以 v2 記錄控制或 Terminal 前置改變；其他案例只修必要定位。
- 核定：main 原樣呈現問題與建議後，使用者回覆「看起來還好」；main 解讀為同意該方案。本輪不宣稱使用者逐案審讀。
- 產品：新同步 worktree 的正式 build 隔離副本，build-info 為 `1.16.2-dev+23484c95-dirty.1791374151`，time 為 `2026-10-07T11:55:51.404Z`。dirty 對應後續單獨 commit 的測試型別／selector 修正；之後只改測試與契約，沒有改產品來跑綠。
- 工具：實際 package.json 為 e2e 0.16.0、@e2e-dev/web 0.11.2、playwright 1.63.0。依既有 bun.lock frozen install，lock 沒有改。
- 環境：web-phone、真 Chromium、390×844、en、fresh context、原 API／pane／history fixture；所有請求限制在隔離 loopback origin，service worker 阻擋，telemetry 關閉、沒有模型／cache。
- runner：既有 workers=1、retries=0、timeout=30000，不改 timeout、retry 或 skip。

## 歷次執行

本輪每次用不同 run-id；report、network evidence、截圖與 trace 另存本機收據，沒有用最後綠燈覆寫原失敗。

| run-id | selected 結果 | 說明 |
| --- | --- | --- |
| upstream-sync-1.17.2-original | 32 passed／37 failed／0 skipped，69 selected | 舊 Dashboard keys 已撤回；Full reply 原案仍依賴舊 Terminal 預設 |
| upstream-sync-1.17.2-targeted-v2 | 15 passed／32 failed，47 selected | 缺正確帶 blocked 計數的 Dashboard 定位；account／retell 的 Find 正向檢查需要 Terminal 前置。其餘 22 未選取，不算產品 skip |
| upstream-sync-1.17.2-targeted-v2-r2 | 18 passed／29 failed，47 selected | 原 screen 顯示 SDK 的名稱是 `Dashboard , 1 blocked`，不是推測的無空白版本；其餘 22 未選取 |
| upstream-sync-1.17.2-targeted-v2-r3 | 47 passed／0 failed／0 selected skipped | 依實際 screen 修定位；產品期待與 API 輸入不放寬 |
| upstream-sync-1.17.2-all-v2 | 69 passed／0 failed／0 skipped，69 selected | 11 檔，exit 0，run.errors 為空；CLI log 開始時間 20:49:11，duration 46.48s |

數字來自各輪原始 report.json 的 selected／status，檔數與時間來自 runner log；不是手動填入 PASS。

## 全套逐檔結果

每檔的逐案 title、版本、步驟與 artifacts 留在完整 report.json。這張表只彙整來源檔，不把未納入的補丁算進分母。

| 檔案 | passed | failed | skipped |
| --- | ---: | ---: | ---: |
| agent-palette.e2e.ts | 1 | 0 | 0 |
| core-web.e2e.ts | 9 | 0 | 0 |
| data-backed-web.e2e.ts | 6 | 0 | 0 |
| loop-account-retell-launch.e2e.ts | 6 | 0 | 0 |
| loop-appearance-zen.e2e.ts | 7 | 0 | 0 |
| loop-changes-idle.e2e.ts | 3 | 0 | 0 |
| loop-language-preferences.e2e.ts | 5 | 0 | 0 |
| loop-navigation-keys.e2e.ts | 12 | 0 | 0 |
| loop-reply-typeface.e2e.ts | 4 | 0 | 0 |
| supplemental-web.e2e.ts | 10 | 0 | 0 |
| sweep-web.e2e.ts | 6 | 0 | 0 |

## 重跑命令

先沿 [README](/web/e2e/tester-army/README.md) 建當前產品的隔離 build，再使用新 run-id。`<isolated-dist>` 是這輪 build 的絕對路徑；不要指向 live Collie 或首次試跑的舊副本。

```bash
COLLIE_E2E_DIST=<isolated-dist> \
COLLIE_E2E_RUN_ID=<new-run-id> \
E2E_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 \
bun run --cwd web/e2e/tester-army test
```

本輪完整輸出在 `.e2e/upstream-sync-1.17.2-all-v2/report.json`、junit.xml、artifacts/ 與該 run 的 network evidence；本機另存副本，不要求把大型 runtime artifacts commit。

## 沒做與限制

- 不驗真 bridge／Herdr socket、真 journal／recap producer、retell child、實際 account switch 或 terminal 收下 keys。
- 不驗原生 iOS、Safari、Windows 或手機更新；不跑 e2e-live、不部署。
- 原涵蓋表的未納入分支與 Typeface 文件差異仍保持，不以這輪通過裁定。
- idle 的 native probe 原樣回 `before=visible, after=visible`；這輪只保護 visible deadline／resume，不把 probe 算 hidden-page 證據。
- 這份結果不能替代上游 Tier1 suite、後端測試、main 的獨立驗收或 release CI；其他 lane 的失敗各自記錄。
