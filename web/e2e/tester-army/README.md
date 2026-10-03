# Collie 網頁補丁回歸測試

目前只保存 Agent 面板的一個流程，使用 TesterArmy。案例語義來自 [ADR 9002](/.adr/9002-the-agent-palette-stages-never-sends.md)，不是實跑後反填預期。原 Playwright suite 與其依賴保留。

- [本次行為契約](/web/e2e/tester-army/contract.md)
- [案例快照](/web/e2e/tester-army/contracts/palette-stage-and-send.v1.md)
- [測試](/web/e2e/tester-army/agent-palette.e2e.ts)
- [首次實跑紀錄](/web/e2e/tester-army/runs/first-web-run.md)

## 測試邊界

真 Chromium 載入 Collie 的正式網頁 build。命令選取、composer、reply-action 都用真產品；bridge、terminal 及其他 API 用 repo 既有 fixture。禁止任何請求離開隔離 loopback origin，Vite 的 API proxy 指向沒有 bridge 的 port 9，service worker 阻擋。

精確檢查 `/status`、`/compact ` 的 composer 文字、面板關閉與 Send 前零 API 寫入；明確 Send 後觀察網頁實際發出的 reply 請求。不使用 agent.*、模型或 cache。

## 合併上游後重跑

先從當前 checkout 建一份新的網頁 build，不能拿首次試跑的舊副本宣稱 merge 後通過。`<new-build>` 是本輪專用的絕對路徑，位於忽略的輸出目錄，不是 live `web/dist`。

```bash
cd web
npm run build -- --outDir <new-build> --emptyOutDir
cd e2e/tester-army
COLLIE_E2E_DIST=<new-build> COLLIE_E2E_RUN_ID=<unique-run-id> npm test
```

CLI 自動取可用 loopback port，啟停測試 server，輸出保存在 `.e2e/<unique-run-id>/`。每輪另存 report、network-evidence、截圖與 trace；不要覆寫舊 run-id。核對 network-evidence 的實際 build-info，不能只看 checkout SHA。

## 依賴與本次本機限制

本目錄的 package.json 釘 e2e 0.16.0、@e2e-dev/web 0.11.2、playwright 1.63.0。首次試跑復用本 session 已審、已安裝的 SDK，沒有重新下載／安裝這兩個未滿七天的版本，沒有升級舊 suite。

本機忽略的 node_modules 暫時指向既有 Linux SDK 目錄；因此這次在 macOS 另以 ESBUILD_BINARY_PATH 指向已滿七天的原生 esbuild 0.28.2。該暫存位置記在本輪本機收據，不寫進可提交文件。重跑此依賴形態時要帶同一環境變數，不能假設跨平台的 node_modules 可直接使用。

這輪沒有驗證乾淨 clone 的依賴安裝，沒有新 lockfile。全新安裝仍須遵守 repo 的七天限制，不能為了跑測試放寬；兩個 SDK 版本都在 2026-10-02 發布，2026-10-04 尚不能新裝。原 suite 的依賴安裝與 lockfiles 不變。

## 未驗證

其餘補丁、真 bridge／Herdr terminal、原生 iOS、Safari、LLM、cache replay、首次案例的產品失效反例，以及 merge 後的真回歸能力都未驗證。本次只證明一個網頁流程可用 TesterArmy 實跑與保存，不代表整套回歸測試集已建立。測試修改沒有可部署的產品效果，所以不重建或部署 active Collie。
