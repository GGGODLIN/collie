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
