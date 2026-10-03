# palette-stage-and-send/v1

## 保護行為

Agent 命令面板只編輯 composer；面板選取不能送往 terminal。只有使用者明確按 Send 才能開始 reply 請求。

## 預期來源

- 文件明載：`/.adr/9002-the-agent-palette-stages-never-sends.md` 第 25–31 行：不帶參數的命令精確填入；帶參數的命令尾端一個空白；兩者都不提交，面板關閉。
- 既有規則：`/CLAUDE.md` 第 546–549 行。
- 來源實作版本另記，不從實測結果反算預期。

## 前置條件與資料

- 真 Chromium 開啟 Collie 正式 build，390×844 網頁 viewport；不是原生 iOS。
- 直接開 `/pane/w1:p1`，沿用 `web/e2e/fixtures/api.ts` 的 API stub 與 `web/src/test/handlers.ts` 的 Claude pane 資料。
- locale 固定 en，沿用 fixture 的 tour-seen 初始化。
- 命令沿用產品既有 Claude catalog：`/status` 不帶參數、`/compact` 可帶參數。
- 每輪獨立瀏覽器 context，service worker 阻擋，所有後端 API 由 fixture 處理，無 live bridge／Herdr socket。

## 動作與必要斷言

1. 開 pane，確認 composer 與 Agent 按鈕可見。
2. 開 Agent 面板，選 `/status`：composer 精確為 `/status`；面板關閉；API 寫入為空。
3. 清空本機 composer；再開面板選 `/compact`：composer 精確為 `/compact `，含尾端一個空白；面板關閉；API 寫入仍為空。
4. 在 composer 補上 `regression`，精確為 `/compact regression`；補字也不提交。
5. 明確按 Send：等待 guarded reply 完成，觀察實際網頁發出的 reply 請求。預期先有 `{text:'/compact regression',submit:false}`，後有 `{submit:true}`，順序不得顛倒；不得有額外非 reply API 寫入；composer 清空。

## 可替代與不可繞過

- 允許替代 bridge、terminal、journal、通知與更新 API；使用 repo 既有 fixture，不自造 pane payload。
- 不可替代命令面板、composer、命令選取、網頁 reply-action 或瀏覽器 request 行為。
- API request listener 必須在首次 navigation 前註冊；零提交不能只看畫面。
- 不驗 LLM、cache replay、原生 iOS、Safari、真 terminal 回應、pairing、crew 或其餘 patch。

## 本次定案方式

使用者限定本次 Collie 委任：依既有人寫文件與決策自主定案並實跑；衝突或只有 code 推測者仍待確認。此案的產品語義來自 ADR，不把目前 code 當權威。這不是使用者逐案審過的紀錄，不改通用 skill 的確認規則。
