# Moshi 探索後的 Collie roadmap

2026-09-24 需求訪談定案。來源：審核頁作答 [review-answers.md](/research/moshi-pro/review-answers.md)、功能對照 [features.md](/research/moshi-pro/features.md)、recap 設計 [recap-design.md](/research/moshi-pro/recap-design.md)。

## 總覽

| 順序 | 項目 | 來自卡片 | 類型 | 規模（估計） |
|---|---|---|---|---|
| ✓ | agent 描述（recap）：列表、pane 畫面、推播共用一份 | N 通知 | 已上線 | — |
| ✓ | `launchers.toml` 加一列 `cc` | R 最近目錄 | 設定，2026-09-24 已設定 | — |
| 2 | 換 Claude 帳號重開 session | U 帳號用量 | 新功能 | 中 |
| 3 | 從列表直接批准 | 1-1 批准 | 新功能 | 中 |
| 4 | 手機上的「白話／跟丟了」 | 使用者 2026-09-24 觀察 | 待訪談 | 未估 |
| ✓ | 手機語音輸入：走 GPT 訂閱轉錄，主機轉台灣繁體 | V 語音 | 設定＋新功能，2026-09-24 已上線 | — |
| ✓ | 本機常駐 STT 服務，手機與電腦共用 | V 語音 | 新工具＋設定，2026-09-24 已上線；VoiceInk 端待使用者設定 | — |

第 1 項排最前面，除了它最小，也因為它順便驗證第 2 項的前提：Collie 開的新 shell 認不認得 `cc` 這個 zsh 函式。

## 1. `launchers.toml` 加一列 `cc`

**要什麼**：在任何 pane 旁邊一鍵多開一個 Claude，目錄自動是那個 pane 的目錄，不用打字。

**做法**：建立 `~/.config/collie/launchers.toml`（實際路徑以本機 Collie 的 config 目錄為準）：

```toml
[[launchers]]
command = "cc"
label = "cc"
```

不寫 `cwd`，從 pane 的切換選單點時，就會用那個 pane 的目錄（[docs/configure.md](/docs/configure.md) 〈Your own launchers〉）。

**已驗證**（2026-09-24）：Herdr 新分頁的 shell 是 zsh，`type cc` 回報 `cc is a shell function from ~/.zshrc`；`GET /api/launchers` 回傳這一列。手機上實際點一次的效果，由使用者驗收。

**不做**：動態的「最近目錄清單」。它要讓 bridge 動態產生可執行的目錄，會放寬 launcher 白名單原則，換到的只是「開一個目前沒有 pane 的舊專案」這個偶爾的情境。

## 2. 換 Claude 帳號重開 session

**要什麼**：在手機上看到某個 Claude 帳號額度快滿時，直接把 session 換到另一個帳號繼續，不用回電腦。

**已拍板**

| 題目 | 決定 |
|---|---|
| 範圍 | 只做 Claude 的兩個帳號（Team-P、Team-S）；GPT 只有一個帳號，不做 |
| 用量顯示 | 不做。Collie 的 pane 鏡像已經顯示 TUI statusline 的用量 |
| 入口 | pane 選單加一列「切換帳號」，點開跳第二層選單挑帳號，防誤觸 |
| 工作中能不能按 | 隨時能按，時機由使用者決定 |
| 模型與 effort | 還原成原本的 |

**我自決的細節**（使用者未否決）

1. agent 工作中時，第二層選好帳號後，再確認一次「會打斷目前這一輪」；閒置時選好就執行。
2. 在原本的 pane 重開，不開新分頁：舊程序必須先結束，兩個程序寫同一份 transcript 會打架。
3. 帳號清單放在設定檔，比照 `launchers.toml`，一列一個帳號（`label`、`command`），bridge 只接受清單裡的帳號。

**做法草圖**

1. 手機只送「pane id ＋ 帳號列」。
2. bridge 從 Herdr 取得這個 pane 的 session id，從 transcript 最新一則 assistant 回應讀出 `model` 與 `effort`，組出 `cc -team-p --resume <id> --model <model> --effort <effort>`。手機永遠不能提供整行指令。
3. bridge 結束原本的 Claude，等 shell 提示回來，再在同一個 pane 執行那行指令。

**已確認的前提**

- 三個帳號目錄的 `projects` 都 symlink 到 `~/.claude/projects`，換帳號後 `--resume` 找得到同一份 transcript。
- 2026-09-10 曾手動把一個 calyx session 用 `--resume` 在 Team-S 重開並繼續工作。
- transcript 每一則 assistant 回應都記了 `model`（例：`claude-opus-5-5`）與 `effort`（例：`high`）。

**動工前要實測**

1. 怎麼從手機結束 Claude：送 `/exit`、兩次 ctrl+c，還是其他方式；工作中打斷時哪個最穩。
2. ~~`cc` 在 Herdr 的新 shell 能不能執行~~：已確認可以（見第 1 項）。
3. `--resume` 本身會不會保留模型；會的話就不用加 `--model`。
4. `ccopus` 的 `opus[1m]`：transcript 只記 `claude-opus-5-5`，沒有 `[1m]`，重開後還是不是 1M context。
5. 帳號切換後，statusline 與 session-account 對應（`/tmp/cc-widget-cache/session-account.json`）有沒有跟著更新。

**風險**：這是 Collie 第一個會結束並重開 agent 的動作，要照 Collie 既有的送出防呆寫：送出前確認畫面沒變，結果不明時不重送。

## 3. 從列表直接批准

**要什麼**：agent 在等批准時，不用進 pane 就能批准。

**已拍板**

| 題目 | 決定 |
|---|---|
| 缺口 | 找得到是誰在等（描述功能已解決），缺的是不用進 pane 就能按 |
| 位置 | 點「在等批准」的列表列時，跳出底部彈窗，顯示完整指令和「拒絕／允許」；不改列表版面 |

**我自決的細節**（使用者未否決）

1. 彈窗裡有「開啟 pane」按鈕，想看完整畫面時從這裡進去。
2. 彈窗的選項跟 pane 畫面的批准按鈕完全一樣（含「Yes, and don't ask again」）：畫面印了哪些，就只顯示哪些。

**做法草圖**：Collie 已在手機端辨認批准對話框（`web/src/lib/harness/claude/prompt-select.ts`），彈窗重用同一個 grammar 與送出防呆。列表只需要額外讀取「blocked」的那幾個 pane，不用讀每個 pane。

**要驗證**：彈窗開著時，終端那邊先答了，彈窗要自己關掉（Moshi 也這樣做，見 features.md 實作線索表「批准」列）。

## 4. 手機上的「白話／跟丟了」

**要什麼**：在手機上也能對某個 session 要一份「白話」或「跟丟了」的重講，結果直接在手機上好讀。

**現況**（2026-09-24 使用者觀察）

- 手機的鏡像會顯示 cc-mod-waitwhat 的按鈕列，但 `[ 白話 ] [ 跟丟了 ] [ 清除 ]` 只是文字，按不了。終端機上要用滑鼠或 `ctrl+x tab` 操作，鏡像沒有這個互動。
- 就算按得到也沒用：mod 在 Herdr 底下會拆一個新 pane 跑 `ww`，手機要再切過去看，在小螢幕上難用。

**可能的方向**（未選，動工前再訪談）

- a. Collie 在 pane 畫面放自己的「白話／跟丟了」按鈕，觸發主機上的重講，結果寫成檔案（比照 recap 的 `~/.cache/cc-recap/`），Collie 讀來顯示。bridge 不能自己對外呼叫模型，所以產生端要留在主機的 mod 或 sidecar。
- b. 手機上改用已經有的 recap（pane 畫面的目標／現在／下一步）當作精簡版，只補「跟丟了」這種長版重講。
- c. 手機的鏡像把 mod 的按鈕列當成 chrome 藏起來，減少雜訊；重講另外處理。

**待決定**：要哪一種、重講結果放在哪個畫面、要不要沿用 mod 的快取與 prompt。

## 5. 本機常駐 STT 服務，手機與電腦共用

**狀態**（2026-09-24）：服務已上線，repo 是 [GGGODLIN/stt-local](https://github.com/GGGODLIN/stt-local)，launchd 常駐在 127.0.0.1:8732。Collie 的 `stt.json` 已改指向它，`collie stt test` 三種格式通過。VoiceInk 的自訂模型要在它的設定畫面填，由使用者完成；手機實際錄音也還沒驗。

**要什麼**：電腦的 TUI 也能用語音輸入，而且跟手機用同一套轉錄。要優化或換引擎時只改一個地方，兩邊一起生效；以後要改回本機模型，也是改這一個地方。

**已拍板**（2026-09-24 訪談）

| 題目 | 決定 |
|---|---|
| 共用方式 | 轉錄抽成本機常駐的獨立服務，講 OpenAI 格式（`POST /v1/audio/transcriptions`）；Collie 與 VoiceInk 都呼叫它，不再由 Collie 自己轉錄 |
| 電腦的入口 | 用已安裝的 VoiceInk 1.79：它負責快捷鍵、錄音、把文字貼到游標處 |
| 潤稿 | 關掉 VoiceInk 的潤稿（現在接 Groq Qwen），服務也先不做；之後需要再加在服務裡 |

**架構**

```
電腦：VoiceInk ──────────────┐
                             ├→ 本機 STT 服務（127.0.0.1）→ codex token → chatgpt.com 轉錄 → 轉台灣繁體
手機 → Collie（只改 stt.json）┘
```

**為什麼可行**

- Collie 的 `openai-compatible` provider 本來就能指向本機網址，設定說明就以 `http://127.0.0.1:8080/v1` 為例（`cli/stt.ts:226`）；它送的是 multipart 的 `file`、`model`、`response_format`（`bridge/stt/openai.ts:59`、`:76`–`:79`），可帶 key（`bridge/stt/config.ts:85`）。
- VoiceInk 只接受 OpenAI 相容的轉錄 API，格式跟 Collie 送出的一樣（執行檔內的 `OpenAICompatibleTranscriptionService`）。
- 拿 codex token、呼叫 chatgpt.com、轉繁體，三段在 Collie 已有能跑的程式（`bridge/stt/codex-auth.ts`、`bridge/stt/codex.ts`、`bridge/stt/convert.ts`）。

**我自決的細節**（使用者未否決）

1. 服務是新的獨立專案，放在 `~/Desktop/projects/` 底下；程式從 Collie 那三個檔案抄過去改，不從 Collie 的 checkout import，避免服務跟著 Collie 的部署變動。
2. 只聽 `127.0.0.1`，並要求帶一把 key：電腦上任何程式都能連本機，沒有 key 等於誰都能用你的 GPT 訂閱轉錄。
3. 用 launchd 開機自動啟動、掛了自動重啟。
4. 不做備援：服務停了，手機和電腦的語音一起停，照實回錯誤，不偷偷改走別的引擎。
5. Collie 裡現有的 codex provider 與轉繁體功能保留不刪，只是 `stt.json` 不再用它；想退回時把 `stt.json` 改回去即可。

**動工前要實測**

1. VoiceInk 的自訂轉錄模型，實際送出的欄位與錄音格式；Collie 單次上限 8MB（`bridge/stt/http.ts:17`），16kHz 單聲道 WAV 約 4 分鐘（估計：8MB ÷ 每秒 32KB）。
2. chatgpt.com 轉錄端點收不收 VoiceInk 的錄音格式（WAV），不收就要在服務裡轉檔（本機已有 `ffmpeg`）。
3. Collie 改指向服務後，`collie stt test` 通過、手機實際錄一次。

**代價**：多一個要常駐的服務，而且它是手機與電腦語音的共同依賴。

## 不做的卡片

| 卡片 | 原因 |
|---|---|
| U 用量顯示 | pane 鏡像已顯示 statusline |
| 2-3 貼圖 | 實測現在的上傳路徑方式可以接受 |
| 2-2 手機預覽網頁、3 離開再回來、J 跳至 | 現在的做法勉強，但使用者不想改用 Moshi 的方式 |
| 1-2 回覆問題、2-1 git 面板、G 手勢 | 沒遇過，或現在的做法夠用 |
| Live Activity、Apple Watch | Collie 是 PWA，做不到 |

## roadmap 以外的待辦

- Moshi 試用環境收尾：iPhone 鏡像輸出改回「每次都詢問」、清掉 `moshi-pro-study/sandbox`、關掉 Herdr 測試分頁 `recap-live`。
- recap 觀察期 2026-10-01 review；mod 版跑順後在 `/config` 關掉官方 recap。
