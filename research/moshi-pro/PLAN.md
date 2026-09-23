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
| T2 切英文 | 未測 | 還沒找到安全的輸入目標 |
| T3 連回 Mac | 部分 ✓ | Moshi 已配對這台 Mac，inbox 列出本機 Claude Code session（moshi-hook 早已裝在 `~/.claude/settings.json`）；主機清單入口還沒找到 |
| T4 閒置不斷線 | 進行中 | 背景每 5 分鐘查 status |

**安全規則（新增）**：Moshi 的 Chat View 會列出執行這次探索的 Claude session 本身，其「對 Moshi 說…」輸入框會把字送進這個 session。打字測試只准在 Herdr 分頁 `moshi-sandbox`（cwd `~/Desktop/projects/moshi-pro-study/sandbox`）裡做，絕不在 collie-gggodlin 那張卡片或它的終端機裡打字。
