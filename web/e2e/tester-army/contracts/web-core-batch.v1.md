# web-core-batch/v1

本次委任定案：使用者在首案通過後說「我要去睡了，就交給你跑完」，沿用 a：只依既有人寫文件與決策定預期、遇衝突或 code-only 仍待確認。這不是逐案批准。

## 共同前置與邊界

真 Chromium、Collie 正式網頁 build 的隔離副本、en locale，沿 repo installApiStub/fixtureSnapshot，fresh context。只測前端實作与實際網頁請求；backend/terminal由fixture取代，不宣稱真terminal或bridge通過。所有API與資源限制在本輪loopback origin，service worker阻擋，沒有LLM/cache。原生iOS排除。

## 新增子集

| ID／版本 | 人寫來源 | 動作與可觀察預期 | 必要觀察 |
| --- | --- | --- | --- |
| title-dash/v1 | FORK.md L32–39 | 開dashboard，可見COLLIE-GGGODLIN | 真bundle header，不是fixture文字 |
| palette-danger-stage/v1 | ADR9002 L25–31 | 開Agent，選一次出貨/clear，composer=/clear、面板關閉、不two-tap | Send之前API寫入為空；不對liveclear |
| bar-compact-direct/v1 | ADR9002 L33–35 | 點harness bar Compact一次，直接發出compact相關reply/keys請求 | 收到真網頁寫入，不以fixtureok推論已按 |
| switcher-dashboard-attention/v1 | ADR9003 L30–34、ADR9004 L21–25、CHANGELOG L707 | dashboard summary開清單，Needs you中的claude在Working中的codex之前 | 實際section與row顺序 |
| switcher-pane-attention/v1 | ADR9004 L21–25 | pane Layers開清單，同attention順序 | 不是workspace分组 |
| switcher-freeze-refresh/v1 | ADR9004 L21–35 | 開清單後改既有snapshot.status，這次開啟不移列；關閉重開採最新 | 等實際更新request，再比可見section；不reload清單 |
| dashboard-stays-place/v1 | ADR9004 L27–28 | dashboard body仍是workspace webapp/collie分組 | 不把Switcher的attention分組移到dashboard |
| switcher-shells-trailing/v1 | ADR9004 L22–25 | in-pane清單保留既有shell列，Shells在attention之後 | 不推定dashboard有Shells，不測空Launch |
| retell-absent/v1 | ADR9005 L54–55 | 未配置retell的預設paneactions不畫Plain/Lost | 先正向證明paneactions sheet正常可見；只frontendflag缺席 |

## 原案與排除

palette-stage-and-send/v1另有原內容指紋，保持不改；其兩個stage分支不重複拆成新案。pane品牌隱藏、Recent toggle、dashboard Shells、空Launch尚缺明确來源，不當已准案例。本文的更新不會重定原預期。只改測試/必要共用fixture，不改產品或依賴、合上游、部署、worker/worktree。
