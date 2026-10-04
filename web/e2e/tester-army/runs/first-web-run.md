# Collie 網頁首次實跑紀錄

## 本輪身份

- 本機日期：2026-10-04；runner 原始 UTC 時間：2026-10-03T18:14:48.873Z 至 18:14:52.655Z。
- run-id：`01a102f9-d001-7c14-9fb8-7bf8835b7e6f`。
- 已定案子集：`palette-stage-and-send/v1`，由人的本次委任定案，不是逐案審核。
- 案例 SHA-256：`fa5b3bc276a4be06e4b12d9c2209031d674769edfcb6ea4620bdf5c142451083`。
- 來源 code：`dc86cf221d96a10106c0905b290bd908da7482c8`，dev；預期來自 ADR 9002。
- 測試 SHA-256：`0b7fb354a60fdb9d1a04fc598e07bbc42f371e8037bbaa113e5faadb17d696eb`。
- 真正受測 build：`1.16.0-dev+dc86cf22.1791041047`，來自當時 `web/dist` 的隔離副本。76 個檔案逐檔 SHA-256 與來源相同；測試也讀取 server 實際 `/build-info.json`，身份相符。
- 工具：e2e 0.16.0、@e2e-dev/web 0.11.2、playwright 1.63.0；Node v24.18.1，macOS arm64，Chromium headless。
- viewport：390×844 網頁；不是原生 iOS、不是 Safari。
- 執行方式：設定 `E2E_TELEMETRY_DISABLED=1`、`DO_NOT_TRACK=1`、本機 `ESBUILD_BINARY_PATH`、`COLLIE_E2E_DIST`、`COLLIE_E2E_RUN_ID=first-attempt`，執行 `npx --no-install e2e run agent-palette.e2e.ts`。本機絕對路徑在 session 原始命令與收據；不寫進可提交文件。

## 預期與實際

| 必要觀察 | 實際結果 |
| --- | --- |
| 無參數命令只填入 | `/status` 精確填入，面板關閉，API 寫入為空 |
| 有參數命令留一個空白 | `/compact ` 精確填入，面板關閉，API 寫入仍為空 |
| 補參數不提交 | composer 為 `/compact regression`，API 寫入仍為空 |
| 明確 Send 才發 reply | 兩個 POST 依序為 `{text:'/compact regression',submit:false}`、`{text:'',submit:true}`，沒有其他 API 寫入，composer 清空 |
| 只連隔離環境 | escapedOrigins=[]；pageErrors=[]；runner 結束後測試 port 58075 沒有 listener |

`e2e list --reporter json` 起跑前選取本契約唯一案例，disposition=run。原始 runner summary：discovered=1、selected=1、executed=1、passed=1、failed=0、flaky=0、skipped=0，exitCode=0；沒有 retry、skip 或放寬斷言。

材料已保存、腳本有真 SDK 實跑證據、產品狀態為「此隔離網頁流程通過」。這是首次基準，不是合併上游後的回歸結論。

## 本輪證據

本機忽略的原始輸出，不是提交到 Git 的公開附件：

- `.e2e/first-attempt/report.json`
- `.e2e/first-attempt/junit.xml`
- `.e2e/first-attempt/network-evidence.json`
- `.e2e/first-attempt/artifacts/`：選取前、選取後未提交、明確 Send 後的截圖，以及 trace.zip。這四個附件存在且符合 report 的 SHA-256；沒有像素比對。
- session 收據：`collie-web-build-snapshot.json`、`collie-web-first-run-checks.json`、`collie-fixture-runtime-preservation.json`。

## 接線失敗與修正

初次網頁實跑直接通過，web 型別檢查另失敗：舊 Playwright 1.62.1 與 SDK Playwright 1.63.0 的完整 Page/Route 型別不相容。只將共用 `web/e2e/fixtures/api.ts` 參數改為實際需要的 route／request／fulfill／addInitScript 能力，不修改 fixture 資料、handler 分支或產品。

第一次介面修正仍把 route 的回傳寫成 Promise<void>；實際兩版都回 Disposable，且 linter 不接受 unknown 回傳。核對兩版宣告後改用 Disposable 與 fixture 的既有 request body 型別。其後 web 與 root 型別檢查、fixture linter 都 exit 0；新增測試的 linter 亦 exit 0。

esbuild 0.28.2 比對 HEAD 原 fixture 與修改後的執行 JS（去型別與註解），SHA-256 兩邊皆為 `86673545a505a5e3613a298882e872562e97d0298224732c6d2c95afe27e12fb`。所以不因純型別修正重跑已通過的同一網頁案例。

## 沒做與未驗證

- iOS 原生、Safari、真 bridge／terminal、其他 patch、產品失效反例、LLM、cache replay、merge 後實際版本全部未驗證。
- 沒有改產品、合上游、開 worker／worktree 或部署。測試與純型別修改沒有可部署的 runtime 效果；沒有跑會覆蓋 active build 的 root build。
- 沒有重裝未滿七天 SDK、沒有升級舊 Playwright。只復用前輪已安裝依賴，加裝已滿七天的原生 esbuild 0.28.2 純依賴於暫存目錄，ignore-scripts。
- 乾淨 clone 安裝與 README 的未來獨立 build 重跑步驟未實測；目前本機依賴復用仍需 ESBUILD_BINARY_PATH。沒有可攜的新 lockfile，不宣稱測試集已可在任意機器安裝。
- 尚未建立其餘 Collie 回歸測試集。本輪到此停止，不自動擴案例。
