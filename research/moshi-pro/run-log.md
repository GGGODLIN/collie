# 過夜探索紀錄

開跑 2026-09-23 23:40。連線狀態另記在 `status-log.txt`（每 30 分鐘，斷線會自動 `open -a` 重連）。

## 情境一：agent 在等我處理

- 23:42 首頁左上角圓圈帶紅色數字「1」＝待處理數。點圓圈（y=113；y≈103 是鏡像工具列死區、y=121 這次沒反應）進收件匣，分「待處理／進行中／已封存」三段。
- 待處理卡片：標題「Write file」、路徑、`sandbox • Claude Code • 27 分鐘前`。
- 點卡片 → 原生批准畫面：工具名、專案名、主機、時間、「權限」標籤、完整路徑；按鈕「開啟終端機」「拒絕」「允許」；下方附帳號用量（5h 0%、7d 99%、Fable 84%，含重置倒數）、主機、模型 `sonnet-5`。截圖 `screenshots/s1-04.png`。
- 23:43 按「允許」→ Mac 端 `herdr agent get moshi-test` 由 blocked 變 done，`sandbox/hello.txt` 已建立。連拍 `clips/s1-approve.mp4`。
- 23:44 agent 用文字列出 a/b/c 選項（本機停用了 AskUserQuestion，所以沒測到選擇題 UI）。卡片即時更新成新訊息。點「開啟終端機」→ 進 Chat View（原生泡泡：使用者訊息綠泡泡、工具呼叫摺成「Write …/sandbox/hello.txt +1 ✓」列、每則附「耗時 4s」）。標題列：session 標題「ls -la 目錄列表」、workspace、模型、git 圖示、指南針圖示。
- 發現：Chat View 輸入框保留了之前在 sandbox 終端機輸入列殘留的注音「ㄜ」→ 草稿跨畫面保留。
- 發現：注音實體鍵盤下，**大寫字母直接輸入英文**（type_text "B" → 輸入框出現 B）。
- 23:46 送出鍵第一次點沒反應，第二次才送出；Mac 端 moshi-test 收到「B」並回「formal」。連拍 `clips/s1-chat-reply.mp4`。

## 情境二：agent 做完，我要驗收回饋

- 23:49 Edit 類批准卡片只顯示路徑，**沒有 diff 預覽**（與 Write 卡片同版型）。從手機按允許後 Mac 端 `hello.txt` 變兩行。
- Chat View 的工具列「Edit …/sandbox/hello.txt +1 ✓」點一下展開 inline diff（`hi` / `+ Good evening, sir.`）。截圖 `screenshots/s2-09.png`。
- Chat View 標題列的 git 圖示有綠點＝有未提交改動；點它（y≈118，y=112 太靠死區會誤觸）開 git 面板，載入約 10 秒。面板：「Uncommitted changes」、分支 master、1 unstaged、+2 −1；五個分頁＝改動／歷史（commit 線圖）／分支（LOCAL）／PR（靠主機 GitHub CLI，無 remote 時顯示「GitHub CLI unavailable」）／檔案樹；改動頁有 List／Diff 切換，檔案列有還原與 stage 按鈕；Diff 是 unified 紅綠區塊加行號、換行切換、開檔按鈕。截圖 `s2-12.png`、`s2-13.png`，連拍 `clips/s2-git-tabs.mp4`。
- 第一次點 git 圖示時跳到「連線中…」再落到原始終端機畫面（可能誤觸標題列別處），第二次才開 git 面板。
- OCR 座標在 git 面板上比例錯（x 到 1085），改用截圖格線座標操作。
- 23:54–00:00 瀏覽器預覽：Mac 起 `python3 -m http.server 8765 --bind 127.0.0.1`（preview-site）。Chat View 標題列指南針圖示點了 4 次都沒開任何畫面；終端機畫面的標題列圖示在 y≈104，落在鏡像死區點不到。**未測到，留給本人驗證**（官方說有主機服務偵測＋SSH 轉送）。
- git 面板底部拉桿在死區：快速下滑、Esc、左緣滑動都關不掉；從 y=107 慢拖到底才關得掉。reset_app 後 Moshi 會還原到同一個面板。
- 00:00 前後 Moshi 一度回到 iOS 主畫面（原因不明，可能 crash 或誤觸）；Spotlight 用大寫「MOSHI」搜尋可重開。
- 意外收穫：iOS 主畫面動態島顯示 Moshi Live Activity（貓眼圖示＋Claude 圖示），截圖 `screenshots/home-01.png`。
- 操作規律：Moshi 按鈕常常第一次點沒反應、第二次才有（收件匣圓圈、開啟終端機、送出鍵都遇過）。
- 00:01 貼圖：Chat View「+」→「新增附件」四選項：相機／照片或影片／剪貼板（附加複製的圖片）／檔案（上傳檔案到主機）。Mac 放一張寫「MOSHI TEST 42」的 PNG 進剪貼簿 → 選剪貼板 → iOS 問允許貼上 → 輸入框出現縮圖。
- 注音下打大寫字串時，「空白＋大寫 I」會變成「。」；不含空白的大寫字串正常。
- 00:03 送出「NUMBER」＋圖片 → Mac 端 Claude 輸入列出現 `[Image #1]NUMBER`，agent 回「42」＝圖片內容確實送達。連拍 `clips/s2-image-send.mp4`。

## 主機端 moshi-hook（0.3.26）看到的實作

- `moshi-hook --help`：「portable daemon + CLI that installs AI agent hooks, serves a local Unix socket bridge, and maintains a WebSocket to Moshi for approval round-trips」。子指令：context、cwd-list、diff（本機 git diff 檢視器）、host（Easy Pair SSH/Mosh）、install、logs、pair、probe、serve、servers（探測本機 TCP listener 並列出 HTTP 服務）；另有 `moshi` 本機 web client、`moshi .` 開 tmux session。
- `moshi-hook logs` 關鍵行：
  - `gateway prompt: text submitted source=claude session=003452b5… terminalKind=herdr pane=wE:pA chars=1` → Chat View 的文字經主機 gateway 送進 Herdr pane。
  - `gateway paste: injected image kind=herdr mode=clipboard verified=true path=/var/folders/…/moshi-paste-*.jpg` → 圖片先存成主機暫存 jpg、放主機剪貼簿、貼進 pane，並驗證。
  - `usage poller: synced count=3 premiumAttached=true usageScope=license` 每分鐘一次 → 用量條的資料來源在主機端輪詢。
- `moshi-hook servers`：列出本機 HTTP 服務（port、HTML title、process、cwd、git 分支），8765 被認成「Moshi preview fixture」→ 瀏覽器預覽的偵測端可用。
- `moshi-hook context`：回報 `kind: herdr`、session、paneId、copyMode、scrollPosition。
- `moshi-hook cwd-list`：列出各 agent 最近的工作目錄＝「最近的目錄」功能的資料源。

## 收件匣與用量

- 收件匣卡片左側圓環的數字：sandbox 卡為 90，而 moshi-test 當時 context 用 10% → 推測圓環＝剩餘 context 百分比（未驗證）；圓環上的閃電圖示含義未知。卡片副標為最後一則使用者訊息（You: …）。
- 點底部「Claude ▬ Codex ▬」條 → 「用量」面板：每個帳號一張卡（Claude Code Team、Codex Pro 20x，標主機與同步時間）；5h／7d／Fable 用量條＋一條刻度線（推測是「照時間平均此刻應到的位置」）＋重置倒數；一句速度判讀「5h 用量進度偏慢・7d 用量進度偏快」；按鈕「7d 額度恢復時提醒我」。截圖 `screenshots/u-01.png`。資料源對應主機 log 的 `usage poller`。
- 00:11 遠端剪貼簿（OSC 52）：往 moshi-test 的 tty（ttys010）寫 `ESC]52;c;base64("OSC52-OK")BEL`，30 秒內 Mac `pbpaste` 仍是原值。**沒有結論**：當時手機停在功能目錄頁、Moshi 可能沒在顯示該 pane；也可能 Herdr 不轉送 OSC 52，或手機剪貼簿不會自動同步回 Mac。留給本人驗證。

## 終端機工具列

- 工具列（左到右）：Ctrl、Esc、Tab、搖桿（方向鍵）、彎箭頭、剪貼簿、Claude 圖示（有 agent 時；切 Chat View）／對話泡泡（開輸入列）、鍵盤。
- 00:15 彎箭頭＝「跳至」側邊欄（原生）：搜尋框「搜尋工作區、分…」、時鐘／清單兩種排序；依 Herdr 工作區分組（名稱＋git 分支＋改動星號），底下是分頁（`>_ 1`）或 agent session（Claude 圖示＋session 標題，如「LLM 使用場景盤點與成本分派」），右側綠點疑似表示 working／未讀，目前所在列反白。截圖 `screenshots/kb-02.png`。
- 00:16 搖桿按鈕：tap、drag、touch 按住 0.8 秒再上移都沒反應，moshi-test 輸入列沒變。**鏡像輸出測不到，留給本人驗證**（官方說明：按住往任意方向拖曳送方向鍵，長按連發）。

## 設定頁（00:17–00:28）

結構：訂閱（Pro 試用剩 2 天、查看授權）／終端機（主題、字型與大小、聊天模式、進階）／輸入（工具列、捷徑、鍵盤、手勢、語音）／整合（Agent Hook、通知、在首頁顯示、檔案分享、Shell）／安全與同步（金鑰生物辨識、恢復時需生物辨識、同步設定、同步密鑰）／一般（語言、應用程式圖示）／說明（文件、探索 Moshi、支援、新功能、推薦、開源授權）；版本 3.15.0。各子頁 OCR 原文在 `settings/*.txt`（Agent Hook 頁的配對權杖已遮蔽；截圖不入庫）。「進階」「工具列」兩頁經鏡像點不開，未收。

重點：
- **聊天模式**：「在文字方塊中撰寫，而非直接輸入」、「聽寫後自動傳送」；聊天檢視標「實驗」，「偵測到智能體時以聊天方式開啟工作階段」；說明寫明「聊天檢視使用主機上執行的代理終端介面（TUI）。訊息會透過加密的 SSH 通道，在主機與此 App 之間直接傳輸，絕不經過 Moshi 伺服器」。
- **捷徑**：長按 Ctrl 開捷徑列；分頁＝收藏／Tmux／Claude（8）／Codex（34）／Copilot（18）／Cursor（24）／OpenCode（8）／Zellij（8）／Herdr（8），可隱藏、排序、點列編輯。
- **鍵盤（實體鍵盤）**：⌘K 捷徑、⌘1-9 切工作階段、⌘W 關閉、⌘V 貼上文字或圖片、⌘J 開聊天視圖、⌘M 聽寫；Option 當 Meta。
- **手勢**：終端機表面單擊／雙擊（貼上）／三擊／下拉（隱藏鍵盤）／滑動（切多工器視窗）／雙指滑動（切面板）／雙指上下（切工作階段）／縮放（字型大小）；浮動輸入列上滑最小化、下滑隱藏鍵盤；工具列按鈕單擊、雙擊、長按可綁動作（例：Ctrl 雙擊開捷徑面板、長按鎖定 Ctrl）；音量鍵也可綁。
- **語音**：引擎 Apple（iOS 26+ 裝置端）／Whisper（本機，Tiny 75MB 到 Turbo 1.6GB，英文專用或 99 語）／Parakeet（實驗，本機多語）／雲端 BYOK（自帶 API key）。有「測試轉錄」。
- **Agent Hook**：安裝指令 `brew tap rjyo/moshi`、`brew install moshi-hook`、`moshi-hook pair --token …`、`moshi-hook install`、`brew services start moshi-hook`；說明「在伺服器上安裝 moshi-hook 以解鎖內容偵測、網頁預覽、差異檢視，以及收件匣與用量轉發」；裝置權杖可更換；Hook 狀態顯示。
- **通知**：開 Moshi 時用「提醒」、關 Moshi 時用「即時動態」（Live Activity，精簡樣式，顯示在鎖定畫面與動態島）；點通知開啟位置可選；「保持螢幕恆亮」；多裝置各自開關；開發者區有「Webhook 與權杖」（推播權杖、測試推播、給自有腳本的 curl）。
- **在首頁顯示**：首頁標題列可放 Agent／檔案／Web 伺服器／模擬器圖示，主機沒跑時隱藏。
- **檔案分享**：上傳至 Moshi API，連結自動複製（這條會經過 Moshi 伺服器，與其他「不經伺服器」的功能不同）。
- **Shell**：連線時偵測最近目錄（掃主機上 Claude/Codex 歷史）、在 tmux 中開啟、匯出 `MOSHI_CLIENT=1` 環境變數。
- **主題**：跟隨系統、深色（Moshi、Dracula、Nord、Solarized Dark、Gruvbox、Catppuccin Mocha）、淺色（Solarized Light、Catppuccin Latte、GitHub Light、Rose Pine Dawn）、可掃 QR／貼上／選檔匯入自訂主題。

## 補測：Chat View 內的批准（00:31）

- 請 moshi-test 建 `reject-me.txt` → 從收件匣卡片「開啟終端機」進 Chat View：工具列「Write …/sandbox/reject-me.txt +1」下方、輸入框上方出現浮動條「等待核准　Write · /Use…eject-me.txt　[拒絕][允許]」。截圖 `screenshots/s1-reject-02.png`。
- 按「拒絕」→ Mac 端 `reject-me.txt` 不存在、moshi-test 回 idle。連拍 `clips/s1-reject.mp4`。
- 同一畫面：先前送的圖片在 Chat View 以大圖泡泡顯示（連線中時先顯示圖片佔位框）。
