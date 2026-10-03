# 建案過程的失敗與修正

本頁保存測試接線失敗，不把它們改成 PASS，也不把建案失敗稱為合併上游後的回歸。

## 核心批次

來源：原 SDK reports `.e2e/core-01/report.json`、`.e2e/core-02/report.json`。

| run | 真實結果 | 標題版本 | 處理 |
| --- | --- | --- | --- |
| core-01 | 8 passed／1 failed | title-dash/v1 | getByText(COLLIE-GGGODLIN) 有一個 match 但 hidden。當時推測兩 session 造成，未證實 |
| core-02 | 8 passed／1 failed | title-dash/v2 | 改單 session 仍 hidden。原歸因撤回，不再往同方向猜 |
| title-03 | 1 passed | title-dash/v3 | 改用原單測 namedHeaderConfig，品牌字仍要求真正可見；原兩 sessions 保留 |

core-02 trace 的最後觀察是 rect x=68、y=7、width=0、height=11；frame snapshot 的 header-identity 沒有 hidden 屬性，mux 名稱那一行是空的。app-header.tsx L330–349 說明品牌字的宽度由 mux 那一列決定。這才是本次可指出的輸入差異，不是手機窄寬或 session 數量。

新前置另存 title-dash/v3 及其指紋。無 mux 的原場景沒有修產品，不當作通過；v1/v2 原契約、report、screen 與 trace 都保留。原 app-header 單測只抽 config 到共同資料，原斷言不變，最近單檔結果 27 passed。

## 資料復用批次

來源：`.e2e/data-01/report.json`、`.e2e/data-02/report.json`。

首次六案是 4 passed／2 failed：

- description：pane 的 goal/now/next 已可見，但測試把 switcher 的「name」誤寫成 workspace `webapp`。失敗 screen 的真列為 `claude logo claude 已讀取檔案`。CHANGELOG L695–696 的期待是 pane 的 name 在上、description 在下。改定位 `/claude/`，仍要求 description 與正向名稱順序，不把 `indexOf=-1` 當成功。
- newest-first：真順序已是 new→mid→old，但既有 element ID 的 host 分隔段使它們為 `switch-row-__new` 等；測試少寫了分隔段。只修身份表示，原時序期待與資料不變。

修後 data-02 是 6 passed／0 failed。沒有改產品、排序清單、description 原文、timeout 或 retry。

## 資料抽取

四個原單測檔保持斷言，最近結果 4 files／80 tests passed：waitwhat-band、agent-commands、triage、pane-description。header 另外 1 file／27 tests passed。這些是資料復用的局部證據，不算 browser 案例數。

## 補充批次

supplement-01 十案是 8 passed／2 failed。帳號兩案、Full reply 三案及其餘三個權限分支已通過；兩個失敗都是 permission command 使用非精確文字定位，同一份 capture 的 prompt、工具列、命令列與按鈕各含該字串，SDK 報 LOCATOR_AMBIGUOUS。

改成 command 的精確全文定位，仍要求該行真正可見；不選第一個 match、不放寬成存在、不改 capture。原 supplement-01 報告保留。最新整批結果另見 baseline 紀錄。

補充資料抽取後，原三個單測檔用名稱選取本次受影響案例：24 passed，155 未選取（Vitest 報 skipped），共列出 179。未選取項不是本輪的行為通過證據；沒有加入 skip 或削弱原斷言。

初版補充 helper 的匿名回傳型別與 unknown 參數被 repo lint 拒絕，改為具名 fixture 介面與 API body 聯集後局部 lint 通過。data description 的 textContent 可為 null，改為空字串 fallback，原名稱存在與先後斷言仍會拒絕空內容；最新 web typecheck 通過。這些只有測試接線變更。

## 失敗控制

另見 [負向控制](/web/e2e/tester-army/runs/negative-control.md)。故意錯 composer expected 真正得到 ASSERTION_FAILED／exit 1，不改正常 suite 的結果。
