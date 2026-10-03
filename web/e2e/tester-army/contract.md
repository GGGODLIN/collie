# Collie 網頁首次回歸試跑

## 首輪範圍（歷史）

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

首輪測試映射到 `agent-palette.e2e.ts`；建案時沒有預填 PASS。首輪後的真實結果另見 runs/first-web-run.md。每輪輸出與證據存獨立目錄；產品失敗保原預期，不改產品、fixture 或斷言湊綠。測試可執行性、網頁符合程度、未驗的真 bridge／terminal 分開報。

## 目前的網頁回歸集範圍

使用者在首輪通過後說「行，看來你跑得通，那我要去睡了，就交給你跑完」。這擴大本題到 fork 網頁補丁回歸集；iOS 仍跳過。沿用同題 a 的文件明載委任，不冒充逐案確認，不沿用到其他專案。前述「只一案」是首輪歷史，不再是本輪執行上限；原 palette-stage-and-send/v1 語義與指紋不改。

- 已定案新增子集：contracts/web-core-batch.v1.md 的九案（title、danger stage、bar direct、五個 switcher/place 邊界、retell 缺席）。SHA-256 `635ce64f19fcc71250c2c81e8654fb39f3abf8963a2075d4454c95db39f0831e`；映射 core-web.e2e.ts。
- 已定案資料復用子集：contracts/data-backed-web.v1.md 的六案（waitwhat 兩形狀、operator merge/override、description 顯示、newest-first）。SHA-256 `1619336717c8b3ac3ad8dc4911e9ece8863322c0e0d135bb971dc531ddc13594`；映射 data-backed-web.e2e.ts。資料來源抽入共用 test 模組，原四個單測檔 80 項通過，斷言未改。
- title-dash/v1/v2 的失敗保存於 core-01/core-02。先前歸因於兩 sessions 是錯誤判斷；core-02 trace 顯示品牌字 width=0、父層沒有 hidden，config 沒有 mux 名稱。active 子集改為 contracts/title-dash.v3.md（原單測 namedHeaderConfig，原兩 sessions，仍斷言真正可見），SHA-256 `1930610ec549fcff568c3655301eba7a9482b96fed68adffbda777bb26643dff`；其餘八案语義不變。無 mux 場景仍是本輪未修的既存差異，不把改前置冒充修產品。
- 本次委任定案補充子集：contracts/supplemental-web.v1.md，SHA-256 `c0aaa1d16f5f8543743671a863255e1a19499d5904c0396190dfd98def3f86f9`，映射 supplemental-web.e2e.ts。先建立 account idle/sent、working 第二次確認，list approval 五案，Full reply 配對／缺 prompt／身份不合三案。draft refusal 與 painted/entity 分支只有抽到原來源資料才能建立；缺資料記阻塞，不編造。只前端與隔離 API 請求，不真切換程序或讀 journal。
- 允許操作：只新測試、必要共用 test fixture 資料抽取、isolated build/server、真 Chromium、exact assertions、獨立證據與自有 Git；仍不改產品、改原期待、合上游、deploy、iOS、live bridge/socket mutation、worker/worktree。
- 觀察邊界：mock 後端只證明前端與網頁請求。資料排序/description/retell 假回覆不等於 bridge 時鐘、recap 讀取、sidecar 或程序控制已驗。
- 來源衝突、缺配對資料與 code-only 仍待確認；不能把 blocked 改成 skip/PASS。
