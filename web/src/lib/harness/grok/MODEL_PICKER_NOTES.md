# Grok `/model` 選單的實測操作

實測環境：macOS、Grok Build `1.0.46 (2765805b9442) [stable]`；版本來自
`grok --version`。日期：2026-10-08。只操作本 session 建立的 Herdr 測試 pane。

## 一個點按只確認當前階段

`/model` 依序顯示模型、視窗大小與思考強度，不是同一個選單一直按 Enter。

| 畫面 | 實測按鍵 | 讀回結果 | 原始資料 |
|---|---|---|---|
| 模型列表，`❯` 在 Grok 4.7 | Down | `❯` 移到 Grok 4.7 Fast；未改模型 | `grok--model-picker.txt`、`grok--model-picker-moved.txt` |
| 回到 Grok 4.7 | Enter | 輸入框補上 `/model Grok 4.7`，出現視窗大小列表 | `grok--model-window.txt` |
| 視窗列表，`❯` 在 256k | Down | `❯` 移到 500k；未提交指令 | `grok--model-window-moved.txt` |
| 回到 256k | Enter | 輸入框補上 `/model Grok 4.7 256k`，出現思考強度列表 | `grok--model-effort.txt` |
| 強度列表，`❯` 在 High | Down | `❯` 移到 Medium；未提交指令 | `grok--model-effort-moved.txt` |
| 回到 High | Enter | 完成指令、選單消失、輸入框清空；狀態仍為 Grok 4.7 (high) | session 的 `grok-model-complete-draft.ansi.txt` |
| 視窗列表 | Ctrl+C | 選單與指令草稿清除，回到一般輸入框 | 本 session 的實測操作與後續讀回 |

完整程式碼與回覆未交給此測試 agent，沒有切換正式工作 pane 的模型。
測試尾段從列表上框線開始，保留原始 ANSI，不帶入本機路徑或啟動 hook 輸出。

## 辨識與送出邊界

只有完整列表、計數上框線、底框線、單列 `/model` 輸入框與 `Enter:send` 提示
同時成立，才建立原生選項。模型、視窗、強度的指令前綴與選項形狀必須一致；
可見列數必須等於上框線計數，恰有一個 `❯`，選項不得重複。

選項沿用 `pointerWalk` 與既有「移動 → 新鮮讀回確認 → Enter」操作，不發明數字鍵，
也不連按 Enter 跨越階段。`signature` 保留原始區域；`coreSignature` 只把列表的
游標換成同寬空白，保留模型、描述、視窗、強度、指令草稿與框線。
三組真正的游標移動截取都列入 `walk-pairs.ts`，不新增例外或略過測試。

原始資料仍交給送出防護。選單出現時，一般文字 Send 不可輸入；其他指令的補全、
不完整列表、未知強度與後面出現新輸出的舊選單都不套此操作。
沒有實測列表兩端是否循環，因此不宣告 `clampedEnds`。
