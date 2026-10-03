# Collie 網頁首次回歸試跑

## 範圍

- task-id：collie-web-first-contract-run-2026-10-04
- repo：Collie GGGODLIN fork，當前 dev checkout。
- 本輪子集：palette-stage-and-send/v1；只跑一個網頁流程，不擴整套。
- 排除：iOS 原生 app、其餘 patch、上游合併、產品修補、部署、真 terminal／socket 寫入、worker／worktree 建立。
- 工具：TesterArmy；沿用同題使用者「這次就用剛剛裝的 e2e 框架」選擇。
- 資產位置：`/web/e2e/tester-army/`，與原 Playwright suite 並存，不修改其依賴與 config。

## 本次委任與定案

- 委任者：本 fork 的使用者，有權決定自己的 patch 行為。
- 人的原話：本 session 在「今晚的預期行為由誰定案？」選單後回「a」，接著說「測試應該網頁的部分先進行，ios的部分相對獨立，也不會受上游影響先跳過／網頁的部分你先試一下有沒有辦法跑通一次」。
- a 的完整範圍：授權依既有人寫文件與決策自主定案並實跑；來源衝突或只有 code 推測者仍待確認。
- 原始訊息定位：當前 Claude Code session `bb27b66d-37bd-4921-be82-c0c1c10a709d` 的上述 top-level 人類訊息；不是 agent fixture 或 approved=true。
- 定案標籤：本次委任定案；不是使用者逐案看過的確認。不修改一般 skill 的確認規則。
- 定案依據：ADR 9002 第 25–31 行與 CLAUDE.md 第 546–549 行一致，無本案語義衝突。
- 可執行子集：`palette-stage-and-send/v1`。
- 快照：`/web/e2e/tester-army/contracts/palette-stage-and-send.v1.md`。
- SHA-256：`fa5b3bc276a4be06e4b12d9c2209031d674769edfcb6ea4620bdf5c142451083`。

## 允許環境與操作

只在 loopback 隔離 server 上開真 Chromium，使用本 repo 已建好的網頁副本及既有 API fixture。網頁正常選命令、編輯與按 Send；Send 只能到 fixture，不可到 live bridge。使用已審已安裝 SDK，若需要 macOS native esbuild，只新增已滿七天的純依賴於隔離暫存目錄，不安裝或升級原 suite。停用 telemetry、沒有 provider 或憑證、不呼叫 agent.*。

## 來源與受測版本

- 本案預期來源：ADR 9002（2026-09-23）與 CLAUDE.md 的 Agent palette 規則；不從實測輸出反算。
- 查 code 時的 commit：`dc86cf221d96a10106c0905b290bd908da7482c8`，dev，起跑前工作樹乾淨。
- 現有 web/dist 身份：`1.16.0-dev+dc86cf22.1791041047`，build-info.sha=`dc86cf22`。
- 每輪另外記錄實際 server 的 build-info、bundle 檔案指紋與測試版本，不能只引用工作目錄 commit。

## 保存與結果

測試映射到 `agent-palette.e2e.ts`。本輪尚未執行，不預填 PASS。每輪輸出與證據存獨立目錄；產品失敗保原預期，不改產品、fixture 或斷言湊綠。測試可執行性、網頁符合程度、未驗的真 bridge／terminal 分開報。
