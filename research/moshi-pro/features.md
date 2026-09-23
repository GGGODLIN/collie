# Moshi Pro 功能盤點：情境卡

2026-09-23 23:40 到 2026-09-24 00:35 的過夜探索結果。操作方式：mirroir-mcp 透過 iPhone 鏡像輸出操作 Moshi 3.15.0（Pro 試用），主機是這台 Mac（Herdr、moshi-hook 0.3.26）。原始逐筆紀錄在 [run-log.md](run-log.md)，官方卡片說明在 `catalog/`，設定頁原文在 `settings/`。

**怎麼讀**：每張卡先寫「你會在什麼時候用」和「你現在怎麼做」，再寫「Moshi 少掉哪一步」。這三段是讓你判斷「需不需要」的；後面的「實作」「我的建議」是判斷「值不值得自己做」的，兩件事分開看。

**Collie 現況的證據強度**：「Collie 有沒有」一欄是 subagent 用程式碼搜尋得出的（附檔案行號），沒有實機驗證 Collie 的行為。

**已排除的鏡像操作摩擦**（不算 Moshi 的缺點）：畫面頂端約 y<105 的區域點不到、按鈕常要點第二次、注音攔截英文、git 面板拉桿點不到。

---

## 情境一：agent 在等我處理

### 1-1 批准工具權限

- **你會在什麼時候用**：離開電腦，agent 卡在「要不要寫這個檔／跑這個指令」。
- **你現在怎麼做**：開 Collie，進那個 pane，Collie 從畫面辨認權限提示、畫成可點選項（`web/src/lib/harness/claude/prompt-select.ts:2`）。
- **Moshi 實測**：
  - 首頁左上角圓圈帶紅色數字＝待處理數；收件匣分「待處理／進行中／完成／已封存」。
  - 待處理卡片點開是原生批准畫面：工具名（Write file／Edit file）、專案、主機、完整路徑、「拒絕／允許」大按鈕，下方還附帳號用量。按允許，Mac 端檔案立刻建立（`clips/s1-approve.mp4`）。
  - 在 Chat View 裡，輸入框上方會浮出「等待核准　Write · …　[拒絕][允許]」，不用離開對話就能批准；按拒絕，檔案沒被建立（`clips/s1-reject.mp4`）。
  - Edit 類批准卡片**只顯示路徑、沒有 diff 預覽**，要看改什麼得進 Chat View 展開工具列。
- **Moshi 少掉哪一步**：不用先找到哪個 pane 在等；收件匣就是跨所有 agent 的待辦清單，批准也不用進終端機畫面。
- **必要資料與控制入口**：Claude Code hooks（PreToolUse／通知類）→ 主機 daemon `moshi-hook`（Unix socket）→ WebSocket 到 Moshi 做批准來回（`moshi-hook --help` 原文）。
- **Collie 有沒有**：部分。Collie 讀畫面辨認提示，不接 hooks；有「needs」分組（`web/src/lib/triage.ts:19`），沒有「已封存」。
- **最小等效做法**：Collie 已能從畫面辨認，缺的是「跨 agent 的待辦清單」這個入口，以及在對話畫面內直接批准的浮動條。
- **未驗證**：AskUserQuestion 選擇題的批准 UI（本機把這個工具停用了，沒測到）；推播點進來的路徑。

### 1-2 回覆 agent 的問題

- **你會在什麼時候用**：agent 列出 a/b/c 選項等你回。
- **你現在怎麼做**：Collie 的 composer 打字送出，或用 Quick replies。
- **Moshi 實測**：卡片即時更新成 agent 的最新訊息；「開啟終端機」進 Chat View（原生泡泡），輸入「B」送出，Mac 端 agent 收到並回「formal」（`clips/s1-chat-reply.mp4`）。主機 log：`gateway prompt: text submitted … terminalKind=herdr pane=wE:pA chars=1`。
- **Moshi 少掉哪一步**：看的是整理過的對話，不是終端機畫面；工具呼叫摺成一列。
- **Collie 有沒有**：部分。有 journal 讀的 history 頁排成對話（`web/src/components/transcript-view.tsx:2`），輸入送回同一 pane。
- **未驗證**：送出鍵第一次常沒反應，可能是鏡像操作問題，也可能是 Moshi 本身；要你親手試。

---

## 情境二：agent 做完，我要驗收回饋

### 2-1 看 agent 改了什麼

- **你會在什麼時候用**：agent 說「改好了」，你想在手機上確認改動。
- **你現在怎麼做**：在 Collie 的 pane 畫面看 Claude Code 自己印出的 diff，或回電腦。
- **Moshi 實測**：
  - Chat View 工具列「Edit …/hello.txt +1 ✓」點一下展開 inline diff。
  - 標題列 git 圖示（有綠點＝有改動）開 git 面板：未提交改動清單（stage、還原按鈕）、List／Diff 切換、unified diff 加行號、commit 歷史線圖、分支、PR（靠主機 GitHub CLI）、檔案樹（`clips/s2-git-tabs.mp4`、`screenshots/s2-13.png`）。
- **Moshi 少掉哪一步**：不用捲終端機找 diff；整個 repo 的改動一頁看完。
- **必要資料與控制入口**：主機端 `moshi-hook diff`；官方說明「Diff 資料會從主機直接到達 app，不經過任何中間伺服器」。
- **Collie 有沒有**：沒有 git 面板（subagent 搜 `git diff`、`git status`、`"gh"` 無命中）。
- **最小等效做法**：bridge 對 pane 的 cwd 跑 `git status --porcelain`＋`git diff`，前端只讀。stage／還原是寫入動作，碰到 Collie 的寫入閘門。
- **未驗證**：大 diff 的效能；PR 分頁有 remote 時的樣子。

### 2-2 看 agent 起的網頁

- **你會在什麼時候用**：agent 改了前端、起了 dev server。
- **你現在怎麼做**：回電腦開瀏覽器，或自己設 Tailscale 轉送。
- **Moshi 實測**：**手機端沒點開**（標題列指南針圖示點 4 次沒反應）。主機端 `moshi-hook servers` 正確列出我開的 8765 port，並用 HTML title 命名成「Moshi preview fixture」，附 process、cwd、git 分支。
- **Moshi 聲稱**：內建瀏覽器開主機上的本機開發伺服器，經 SSH 轉送，不經中間伺服器（官方卡片）。
- **Collie 有沒有**：沒有（搜 `localhost:[0-9]`、`lsof` 無命中）。
- **未驗證**：整段手機體驗 → **需要本人驗證**。

### 2-3 貼圖給 agent

- **你會在什麼時候用**：想給 agent 看截圖、設計稿、錯誤畫面。
- **你現在怎麼做**：Collie 上傳檔案，bridge 存成主機暫存檔，訊息裡放路徑讓 agent 自己讀（`bridge/uploads.ts:9-11`）。
- **Moshi 實測**：Chat View「+」→ 相機／照片或影片／剪貼板／檔案（上傳到主機）。選剪貼板後圖片變縮圖、加一句「NUMBER」送出，agent 回「42」＝真的讀到圖片內容（`clips/s2-image-send.mp4`）。主機 log：`gateway paste: injected image mode=clipboard verified=true path=/var/folders/…/moshi-paste-*.jpg`。
- **Moshi 少掉哪一步**：agent 收到的是原生圖片附件（`[Image #1]`），不是路徑。
- **Collie 有沒有**：部分（有上傳，機制不同）。
- **實作差異**：Moshi 用主機剪貼簿＋貼上，會覆蓋主機剪貼簿；Collie 的路徑法不碰剪貼簿。
- **未驗證**：標註（裁切、塗鴉）功能沒測到。

---

## 情境三：離開手機再回來

- **你會在什麼時候用**：切去別的 app、手機鎖了、網路換了，回來繼續。
- **你現在怎麼做**：重開 Collie PWA，它重新輪詢。
- **Moshi 實測**：`reset_app` 強制關閉 Moshi 後重開，會回到同一個畫面（連 git 面板都還原），SSH 工作階段自動重連（標題列顯示「連線中…」「Checking session status…」約 5 到 15 秒）。主畫面動態島一直顯示 Moshi 的 Live Activity（貓眼＋Claude 圖示，`screenshots/home-01.png`）。
- **Moshi 少掉哪一步**：不用重新找回原本的 pane。
- **Collie 有沒有**：未核對。推測 Collie 走 HTTP 輪詢、沒有長連線要重接，畫面位置靠 React Router 路由保留（未驗證）。
- **需要本人驗證**：鎖定畫面的 Live Activity 內容、推播通知、Mosh 連線（這台 Mac 沒裝 mosh-server）。

---

## 其他功能（官方說明＋部分實測）

| 功能 | 實測或來源 | Collie 有沒有（程式碼搜尋） |
|---|---|---|
| 帳號用量 | 實測：Claude Code（5h／7d／Fable）、Codex（7d）用量條加「此刻應到的位置」刻度線、重置倒數、「5h 進度偏慢・7d 進度偏快」判讀、「7d 額度恢復時提醒我」。資料來源是主機每分鐘的 `usage poller` | 沒有（只有 prompt cache 到期 chip） |
| 收件匣圓環數字 | 實測：sandbox 卡顯示 90，同時 context 用了 10% → 推測是剩餘 context 百分比（未驗證） | 沒找到 |
| 跳至側邊欄 | 實測：依 Herdr 工作區→分頁／agent session 標題分組，搜尋框、最近使用排序、分支與改動標記 | 部分（有側邊欄與切換器，無搜尋、無最近排序） |
| 捷徑面板 | 設定頁：依 Tmux／Claude／Codex／Copilot／Cursor／OpenCode／Zellij／Herdr 分頁的命令捷徑，可隱藏、排序、自訂；長按 Ctrl 開 | 有（Agent palette＋harness bar，`commands.toml` 自訂） |
| 終端手勢 | 設定頁：單擊／雙擊／三擊／下拉／滑動／雙指滑動／縮放，工具列按鈕與音量鍵都可綁動作 | 沒有（有 Keys 抽屜） |
| 鍵盤工具列搖桿 | 官方：按住拖曳送方向鍵、長按連發。鏡像測不到 | — 需要本人驗證 |
| 語音 | 設定頁：Apple（iOS 26+ 裝置端）、Whisper 本機（75 MB 到 1.6 GB）、Parakeet（實驗）、雲端 BYOK；有測試轉錄 | 有（STT provider seam，含 whisper.cpp／parakeet.cpp） |
| 通知與 Live Activity | 設定頁：開 app 時提醒、關 app 時用 Live Activity（鎖定畫面＋動態島）；點通知開啟位置可選；多裝置；Webhook 與推播權杖給自有腳本 | 部分（Web Push；無 Live Activity、無 Webhook） |
| 最近目錄 | 主機 `moshi-hook cwd-list` 實測列出各 agent 最近目錄；Shell 設定：連線時偵測、一鍵開 shell 或 tmux | 沒有（`launchers.toml` 是事先宣告） |
| 遠端剪貼簿 OSC 52 | 實測沒有結論（Mac 端沒收到同步） | 沒有 |
| 主題與字型 | 設定頁：10 套終端配色＋QR／貼上／檔案匯入 | 部分（UI 三種主題＋自訂字型） |
| 硬體鍵盤（iPad） | 設定頁：⌘K／⌘1-9／⌘W／⌘V（含圖片）／⌘J／⌘M；Option 當 Meta | 未查 |
| 金鑰生物辨識、設定同步 | 設定頁開關 | 不適用（Collie 用裝置配對憑證） |
| 檔案分享 | 設定頁：上傳到 Moshi API、連結自動複製（**這條會經過 Moshi 伺服器**） | 未查 |
| Apple Watch | 官方：手錶上直接允許 | — 需要本人驗證 |

---

## 我的建議（和「需不需要」分開看）

這段是我對「值不值得做進 Collie」的判斷，請先看完上面的情境再看這裡。

| 候選 | 建議 | 理由 | 難度 |
|---|---|---|---|
| 跨 agent 待辦清單＋對話內批准浮動條 | 值得做 | Collie 已能辨認提示，缺的是入口與位置；hooks 不是必要條件 | 中 |
| 帳號用量條 | 值得做 | 你本機已有 quota cache 與 statusline 資料源；Moshi 靠主機輪詢，同一路 | 中 |
| git 面板（唯讀：狀態＋diff＋歷史） | 值得做 | 驗收回饋的主要缺口；唯讀版不碰寫入閘門 | 中 |
| 瀏覽器預覽 | 可有可無 | 要偵測 port 又要轉送，碰到 Collie 的單一前門與安全邊界 | 高 |
| 最近目錄開新 shell | 可有可無 | `launchers.toml` 已涵蓋「開新 pane」；動態目錄要放寬 allowlist 原則 | 中 |
| 原生圖片附件（剪貼簿法） | 不建議照抄 | 會覆蓋主機剪貼簿；Collie 的路徑法已夠用 | 低 |
| Live Activity、Apple Watch | 不適合 Collie | PWA 做不到 | — |
| 終端手勢、搖桿 | 先親手試再說 | 鏡像測不到手感 | 中 |
