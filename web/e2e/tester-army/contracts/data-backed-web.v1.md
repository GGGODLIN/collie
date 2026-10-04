# data-backed-web/v1

## 定案與資料來源

沿本次人的睡前委任與 a 的範圍，只有已明載預期可實跑。資料從 repo 原有單測輸入抽出至 `web/src/test/fork-regression-data.ts`，原單測也改用同一份；不是案例自造另一個 payload。原四個單測檔的斷言保持。原始 source 的 file:line 與字面值另記 provenance。

共同環境同 web-core-batch：真 Chromium、隔離正式 build、既有 API stub、en、fresh context、無 model/cache、無真 bridge/terminal。mock 只替代 API 的資料來源，不能替代受測前端組清單、render/grammar、排序或 description 顯示。

## 子集與應有行為

| ID／版本 | 人寫來源 | 資料與操作 | 預期／必要觀察 |
| --- | --- | --- | --- |
| waitwhat-idle-hidden/v1 | FORK.md L76–86、CHANGELOG L710 | 使用原 waitwhat-band.test.ts L17–23 的 live-pane shape，透過既有pane response wire呈現 | Done仍可見；wait what header不顯示；不直接呼叫strip函数 |
| waitwhat-retelling-hidden/v1 | 同上（recap line與其下retelling） | 原test L27–37整份rows | Done仍可見，header、recap、退回原因、重講內容都不顯示 |
| operator-claude-merge/v1 | ADR9001 L25–32/L44–45 | config加入原agent-commands.test.ts L165–171 operatorDeploy，開Claude palette | Deploy staging先出現；出貨/compact仍可搜尋/選；選custom也只stage無API寫入 |
| operator-exact-override/v1 | ADR9001 L29–32 | 原unit L183–190 operatorClear | /clear恰好一列，描述Clear after saving notes、hint[note]；選後composer精確/clear尾一空白，零API寫入。此UI觀察不證明danger flag，danger-floor由既有單測證據另列 |
| description-recap-display/v1 | CHANGELOG L693/L695–696 | 原pane-description.test.tsx L13 recapDescription放入既有snapshot的claude description | pane顯示goal/now/next及原文；switcher仍name在上、description在下。只顯示，不算bridge recap讀取/優先序 |
| attention-newest-first/v1 | ADR9003 L30–34、ADR9004 L36–37 | 原triage.test.ts L122–126 old100/new900/mid500，三個既有factory actor | Switcher Needs you內真正可見row順序new→mid→old，不是從本次排序結果反填期待；不宣稱bridge生成時鐘已驗 |

## 未由這批驗證

非Claude整表替換、bar danger floor、tie/untimed/Recent反轉等保持庫存或待確認；不將本批通過當它們全覆蓋。這批的fixture是來源輸入，不預先放排序後清單或render後結果。
