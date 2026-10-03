# title-dash/v2

## 預期與來源

FORK.md L32–39：這個 fork 的 header 品牌字是 COLLIE-GGGODLIN，不是上游 Collie。期待仍是可見字串，不降為存在於 DOM。

## 前置條件與版本差額

單一 primary session 的 dashboard，en，真 Chromium 390×844，隔離 build 與 repo API fixture。使用 structuredClone(fixtureSnapshot)，sessions 僅保留其已存在的第一個 primary session，不造另一份 session payload；其餘 agents/workspaces/tabs 保留。

v1 選了預設兩個 session 的世界，其 header 的 session switcher 佔身份位置，所以 wordmark match 存在但 hidden。錯誤是測試情境選擇，不是新確認了「手機可以隱藏品牌」的產品規格。v1 的失敗 report/core-01 留存；不改它的快照或結果。

v2 只是選到品牌字真正出現的前置狀態，仍驗同一個文件明載的 fork 字串與可見性。reachability 來源：app-header.tsx 的 header-identity hidden={!claim.wordmark} 與其完整註解 L338–349；不是從這次實際字串反填期待。本次 a 委任允许查 code 建立前置與工具接線；正確文字由 FORK.md 決定。

## 動作與觀察

開 `/`，確認真網頁的 COLLIE-GGGODLIN 可見。不直接改 DOM、不呼叫 React component、不對 fixture 先填理想 header。不驗多 session 的 header 選位規則，那是這次未納入的上游行為。

## 授權與邊界

沿使用者本次睡前委任定案，不冒充逐案人審。不改產品、原預期字串、iOS、真 bridge/terminal。此版本替代 active title-dash/v1；v1 保留為建案時前置選錯的歷史紀錄，不當成 fork 產品回歸。
