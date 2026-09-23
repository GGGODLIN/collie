# Moshi Pro 探索計畫

目標：把 Moshi Pro 的功能整理成 `features.md`，每項寫「它做什麼 → 怎麼觸發 → 觀察到的行為 → 推測的實作 → 自製難度 → Collie 是否已有」，判斷哪些能做進 Collie。

## 工具鏈

- mirroir-mcp 0.39.0（Homebrew）透過 macOS iPhone 鏡像輸出操作手機。
- 本 session 沒載入 MCP，改用 scratchpad 的 `m.py` 以 stdio JSON-RPC 直接呼叫 server；server cwd 固定在 `~/Desktop/projects/moshi-pro-study`，以套用該處的 `.mirroir-mcp/permissions.json`。
- OCR 語言：`MIRROIR_OCR_LANGUAGES=zh-Hant,en-US`。

## 已知限制

- 輸入類 tool（tap、type_text、swipe…）會把 iPhone 鏡像輸出拉到最前面，搶走 Mac 的鍵盤焦點；唯讀 tool（status、describe_screen、screenshot）不會。所以手機操作只在使用者不用 Mac 時跑。
- 鏡像輸出不顯示 iOS 軟鍵盤；帶修飾鍵的組合鍵（Cmd／Ctrl＋X）不會送進 iOS app（mirroir 官方文件 limitations.md）。
- iPhone 實體鍵盤輸入法是注音時，type_text 打的英文會被注音攔截（2026-09-23 實測：Spotlight 打「Moshi」變成搜尋「m」）。
- 語音輸入、Face ID、Apple Watch、鎖定畫面 Live Activity 測不到，只能讀官方文件或請使用者手動試。

## 階段

### 第 0 階段：可行性測試（要使用者讓出 Mac 約 10 分鐘）

| # | 測什麼 | 通過條件 |
|---|---|---|
| T1 | 在 Moshi 裡 tap 能點到按鈕 | 點完 describe_screen 看到畫面變化 |
| T2 | 切英文：送 Caps Lock，再 type_text `echo ok` | Moshi 輸入框出現 `echo ok` 而非注音 |
| T3 | Moshi 已存或能新增連到這台 Mac 的主機（Tailscale `macbook-pro`，SSH 22 port 已開） | 連上後能看到 shell 提示字元 |
| T4 | 鏡像輸出閒置不斷線 | 背景每 5 分鐘 `status`，連續 2 小時都是 Connected |
| T5 | 斷線自救：`open -a "iPhone Mirroring"` 能重連 | 重連後 status 回 Connected |

T2 不通過的備案：請使用者在手機「設定 → 一般 → 鍵盤 → 實體鍵盤」把輸入切成英文（只做一次）。

### 第 1 階段：官方文件（不用手機，可隨時跑）

讀 https://getmoshi.app/docs 及其子頁（hooks、image-paste、install-moshi-hook、security-sync、tailscale、voice）、pricing、compare 頁，先列出功能清單草稿，並標出哪些只能在手機上確認。

### 第 2 階段：過夜手機探索（使用者睡前啟動）

- 開跑前：`caffeinate -dis` 防止 Mac 睡眠；iPhone 鎖定、接電源、放 Mac 旁邊。
- 依第 1 階段清單逐項操作，每步「動作 → describe_screen 確認」，每項功能存 1–3 張截圖到 `screenshots/`。
- 每 30 分鐘 `status` 檢查；斷線就試 T5，重試兩次仍失敗就停下、寫進 `run-log.md`。
- 只在 Moshi 裡操作；在 Moshi 連到這台 Mac 的 shell 裡只跑唯讀指令（`ls`、`pwd`、`echo`、`herdr` 查詢類），不改檔、不裝東西。

### 第 3 階段：整理

早上交 `features.md` 與 `run-log.md`（跑了哪些、卡在哪、哪些要使用者手動試）。

## 可行性測試結果（2026-09-23 21:59–22:03）

| # | 結果 | 證據 |
|---|---|---|
| T1 點擊 | ✓ | 點 inbox 列表開出 session 卡片；點「開啟終端機」進 Chat View；點設定齒輪進設定頁 |
| — 頂部死區 | 發現 | y≈103 以上的點擊被 iPhone 鏡像輸出自己的懸浮工具列吃掉；同一顆齒輪改點 y=117 就成功 |
| T1 滑動 | ✓ | inbox 下拉有反應 |
| T2 打英文 | ✗ 直接打／✓ 剪貼簿 | 直接 type_text「echo ok」只出現注音「ㄜ」；mirroir 不支援 Caps Lock，System Events 送 key code 57 也無效。改走 `pbcopy` → 通用剪貼簿 → 點 Moshi 工具列的貼上鍵 → iOS 問「允許貼上」→ 允許，sandbox 收到 `echo ok-from-clipboard`，`press_key return` 執行成功 |
| T3 連回 Mac | ✓ | 使用者重開 app 後左上角可切到工作階段清單 → 連線 `linhancheng@100.101.86.18` → Herdr 選擇器（抽屜要用 drag 拉上來才看得到全部工作區）→ collie-gggodlin → switch → `2 · moshi-sandbox` |
| T4 閒置不斷線 | 進行中 | 21:53–22:23 每 5 分鐘 status 全為 Connected |

**安全規則（新增）**：Moshi 的 Chat View 會列出執行這次探索的 Claude session 本身，其「對 Moshi 說…」輸入框會把字送進這個 session。打字測試只准在 Herdr 分頁 `moshi-sandbox`（cwd `~/Desktop/projects/moshi-pro-study/sandbox`）裡做，絕不在 collie-gggodlin 那張卡片或它的終端機裡打字。

**操作訣竅（過夜要用）**

- 打英文一律走剪貼簿：`pbcopy` → 點 Moshi 工具列貼上鍵 → 若跳「允許貼上」就點允許。副作用：會蓋掉 Mac 的剪貼簿。
- 系統對話框（例如允許貼上）的 OCR 座標比例會偏，以截圖格線座標為準。
- Moshi 疑似卡住時，照使用者指示重開 app（`reset_app` 後再從主畫面開）。
- 驗證輸入結果用 `herdr pane read wE:pA`，不靠 OCR。

## 演練結果（2026-09-23 23:06–23:15）

| 項目 | 結果 | 證據 |
|---|---|---|
| T5 斷線自救 | ✓（需「自動認證」） | 預設設定下重開鏡像輸出要 Mac Touch ID／密碼；使用者改成自動認證後，從連線中 quit → `open -a "iPhone Mirroring"`，15 秒內 Connected |
| 手機解鎖 | 會中斷鏡像 | 使用者解鎖手機後鏡像輸出關閉；過夜期間不碰手機 |
| 錄影 | ✗ | `start_recording` 一開始，status 立刻變 Paused，影片全黑；停止後恢復 Connected |
| 連拍取代錄影 | ✓ | 同一 server process 連拍 6 張約 10 秒，全程 Connected；ffmpeg 2 fps、寬 360 接成 3 秒 mp4 只有 19 KB，字看得清楚 |
| 重開 Moshi | ✓ | `reset_app Moshi` → `spotlight` → 點建議清單第一格 Moshi → 自動接回 moshi-sandbox |
| 測試 agent | ✓ | Herdr agent `moshi-test`（pane wE:pA，Sonnet，`--permission-mode default`）；啟動時拒絕上層 `.mcp.json` 的 mirroir，不給它碰手機；請它建 hello.txt 觸發 Write 批准，Moshi 標頭顯示「1 blocked」。`ls` 不會觸發批准 |
| 固定測試資料 | ✓ | `sandbox/diff-fixture`（git repo，app.py 有未提交改動）、`sandbox/preview-site/index.html` |

## 修訂後的過夜計畫（採納 GPT-6 Pro 審查）

**紀錄方式**：情境卡，不是功能卡。每張卡寫「你會在什麼時候用 → 你現在怎麼做（Collie／回電腦）→ Moshi 少掉哪一步 → 必要資料與控制入口 → Collie 有沒有 → 最小等效做法 → 未驗證之處」，附連拍短片（2 fps mp4）與關鍵截圖。鏡像操作的摩擦另記，不算 Moshi 的缺點。早上交 `review.html`，問三題：最近遇過嗎、現有做法夠嗎、下次會改用嗎。

**順序**：
1. 情境一「agent 在等我處理」：在 inbox／Chat View 找到 moshi-test、看懂在等什麼、從手機批准或回覆，Mac 端用 `herdr agent read` 確認收到。
2. 情境二「agent 做完，我要驗收回饋」：Diff 檢視器看 diff-fixture、瀏覽器預覽看 preview-site、貼圖並標註送給 moshi-test，Mac 端確認收到正確內容。
3. 情境三「離開再回來」：重開 Moshi、切換 Herdr 分頁後能否回到原工作。
4. 其餘功能有空全部掃過（使用者要求夜晚盡量探索完整）：快速鍵面板、鍵盤工具列、跳至、終端手勢、最近目錄、遠端剪貼簿、設定頁各選項。
5. 需要本人驗證（不是不重要）：語音、Apple Watch、Live Activity／鎖定畫面、推播、Face ID。

**安全規則**：
- 所有會改變狀態的操作（打字、送出、批准、拒絕、關分頁、中斷）只對 `moshi-test`／`moshi-sandbox`；送出前核對手機標頭是 `tab moshi-sandbox`，Mac 端 `herdr agent get moshi-test` 對得上，對不上就不操作。
- 結果不明先用 Herdr 讀，不重送。過夜只有我一個手機操作者。
- 每項最多 20 分鐘；同一步沒進展就停止重點，最多重開 Moshi 一次。
- 鏡像斷線 → `open -a` 重連，連兩次失敗就停止手機操作，改整理資料。要求解鎖也停止。
- 每 30 分鐘記一次 status 到 `run-log.md`。
