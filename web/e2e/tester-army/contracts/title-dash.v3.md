# title-dash/v3

## 預期與定案

FORK.md L32–39：header 的 fork 品牌字是 COLLIE-GGGODLIN。沿本次 a 的睡前網頁委任，仍斷言真正可見，不改產品或放寬為 DOM 存在。

## 前置與來源

真 Chromium 390×844、en、隔離 build。保留原 fixtureSnapshot 的兩個 sessions。config 使用 app-header.test.tsx 原 L263–267 的具名 multiplexer 資料（name=reference），抽到共用 namedHeaderConfig；原單測也讀這份資料，原斷言不變。此輸入來自既有單測，不自造另一個 payload。

## 前版差額

v1 與 v2 的品牌字皆 hidden；core-02 的 trace DOM 沒有 header-identity 的 hidden 屬性，最後 rect 為 width=0、height=11。API fixture 未宣告 mux，名稱那一列為空；app-header.tsx L330–349 說明品牌字的寬度由 mux 那一列決定。先前將失敗歸因於 session 數量並未得到證據支持，撤回該判斷。v2 的單 session 改動也沒有解決問題。

v3 改用已有具名 mux 的輸入，且恢復原 session 清單，限定驗這個前置的品牌可見。沒有 mux 的原場景仍留下失敗證據，不冒稱修好或把它算 PASS。本輪不修產品。

## 動作與觀察

開 `/`，先確認 on reference 可見，再確認 COLLIE-GGGODLIN 可見。不中途改 DOM 或 mock 前端組件。原期待文字仍來自 FORK.md。

## 範圍

取代 active title-dash/v2；v1/v2 快照與失敗報告保留。只前端，不含 iOS、真 bridge/terminal 或上游合併。
