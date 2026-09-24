# Agent 描述（recap）設計紀錄

2026-09-24 與使用者訪談定案。起點是 Moshi 探索後的審核回答（[review-answers.md](review-answers.md)）：通知與整個資訊面「光看 title 不知道 session 在做什麼」。

## 原則

**同一份描述、同一套決定規則，所有畫面共用**：Collie 列表、pane 畫面、推播通知都讀 bridge 算出的同一份描述，只挑欄位、截斷長度，不各自產生或各自排優先序。

## 資料

| 欄位 | 內容 |
|---|---|
| `goal` | 整體目標（約 15 字內） |
| `now` | 正在做什麼或在等什麼（約 15 字內） |
| `next` | 下一個動作與誰做；agent 寫「我」、使用者寫「你」 |
| `source` | `recap`／`blocked`／`prompt` |
| `at` | 產生時間 |

## 產生端：cc-mod-waitwhat（Claude Code function hooks）

- 模型：外部 API，主力 `groq-qwen-3.8-27b`（CLIProxyAPI :8317 → LiteLLM 8 把 key），失敗退回 `gpt-6-luna-fast`。
- Prompt：以官方 away summary prompt 為底（Claude Code 2.1.281 執行檔字串：「The user stepped away and is coming back. Recap in under 40 words…」），改成輸出 `goal`／`now`／`next` JSON，用對話語言，人稱統一「我／你」。實測樣本見 `recap-lab/`（不入庫）。
- 送出內容：只送尾段，輸入預算 5,000 token（CJK 字算 1、其他每 3 字元算 1），`max_tokens` 300；收到 `Request too large` 砍半重送一次，再失敗走備援模型。
- 觸發：一輪結束（`turn.complete`／`classic.Stop`）後閒置 5 秒；同一 session 1 分鐘內最多一次。
- 跳過：上一則 recap 後沒有新內容、輸入框有未送出草稿、`claude -p` 無畫面執行、還沒結束過任何一輪。背景工作仍在跑時照常產生，`now` 寫它在等什麼。
- 寫出：以 session id 命名的檔案，給 Collie 讀；mod 自己的按鈕列顯示同一份。
- 官方 recap：mod 版跑順後再用 `/config` 關閉。

## 決定規則（只在 Collie bridge）

1. agent 在等批准 → `now` 用樣板「在等你批准 <工具> · <路徑>」，`goal`／`next` 沿用上一則 recap，不呼叫模型。
2. 有新鮮的 recap → 用 recap。recap 之後又有新的使用者訊息，視為過時。
3. 都沒有（Codex、沒裝 mod、新 session、產生失敗） → 第一行「你：<最後一則 user prompt>」。

## 各畫面取用

| 畫面 | 取用 |
|---|---|
| Collie 列表（44px） | 第一行 `now`（或「你：…」），第二行標題 |
| Collie pane 畫面 | `goal`、`now`、`next` 全部 |
| 推播通知 | 只放 `now` |
| mod 按鈕列 | mod 自己剛寫的 recap |

## 容量依據（2026-09-24 量測）

- 號池：8 把 key，每把 8,000 TPM、30 RPM、1,000 RPD、每分鐘輸出 1,000 token（錯誤訊息實測）、2M TPD（memory 記載，未重測）。
- 現況尖峰：每分鐘 17,804 token（64k 的 28%）；每日最多 157 萬 token。
- 加上 recap 估計：每日多約 200 萬 token、尖峰每分鐘多約 18,000 token（每日最多 566 輪 × 約 3,600 token；尖峰 1 分鐘 5 輪）。
- 風險：LiteLLM `RateLimitErrorAllowedFails: 0`＋`cooldown_time: 60`，撞一次 429 即冷凍該 key 60 秒。
