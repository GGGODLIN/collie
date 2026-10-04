# Collie 網頁連續 sweep

## 目標與界限

使用者批准先列 Collie 網頁已知流程，再一批接一批自主測試、找錯、最小修補與獨立驗證。「測到底」是清單各項有結果，不保證產品零 bug；不是完成第一包就停止。

本輪沿 `fix/e2e-sweep-web`，起點 `d3435b4edf18339cf311d8651667c49aeab5e84a`。原五個 TesterArmy 檔／32 案與期待保持；上一輪原始結果見 [第一包](/web/e2e/tester-army/runs/sweep-2026-10-04.md)。未改內容不為湊工作重跑。

只用真前端與既有 API fixture。iOS、真 bridge／terminal、sidecar、真開 pane、git 副作用、上游合併排除。不 push、PR、合併、部署、release 或刪 branch；不新裝 skill／SDK／provider／MCP／hook。按固定 [e2e-sweep 原文](https://github.com/rav4nn/skills/blob/351062e71e948bcaad3ae654ef76c7ac06815957/skills/e2e-sweep/SKILL.md) 編排，沒有直接 invoke 原外部 skill。

## 來源清單與批次

以下是目前已定位來源的候選清單，不宣稱所有網頁可能分支都已枚舉。來源期待與原輸入都須在每批動手前對回；尚未實跑不能填 PASS。「原單測尚未抽成共用資料」不是阻塞，允許精確抽原輸入、保留原斷言。

| 批次 | 流程 | 人寫來源 | 本輪狀態 |
| --- | --- | --- | --- |
| 1 | 返回上一層／sheet 不增歷史；Keys 佇列離開二次確認與丟棄；儀表底欄分頁與 Focus（原名 Attention）只過濾 | [DESIGN.md §12](/DESIGN.md)、[ADR0067](/.adr/0067-back-goes-up-one-level.md)、[ADR0005](/.adr/0005-a-composed-key-queue-never-outlives-its-dock.md)、[ADR0066](/.adr/0066-the-dashboard-has-a-footer-panes-needs-you-changes.md) 及 [ADR0068](/.adr/0068-the-second-tab-is-focus-not-attention.md)／[ADR0070](/.adr/0070-a-pin-is-a-place-the-operator-chose.md) 修訂 | V4：原 32＋本批 12，獨立整套 44 passed；無產品修補 |
| 2 | 主題裝置偏好；Zen 的啟用與切 pane 重設；缺 launcher 宣告時安靜缺席 | [configure.md](/docs/configure.md) 主題／Zen／Launch 段 | V4：前 44＋本批七案，獨立整套 51 passed；Theme 配色／Zen 換 pane 子項未驗 |
| 3 | 帳號切換拒絕的 UI；retell 已配置的 UI／回應；launcher 列／請求與唯讀狀態 | [CHANGELOG.md](/CHANGELOG.md) account 項、[configure.md](/docs/configure.md) retell／Launch 段 | V4：前 51＋本批六案，獨立整套 57 passed；只有測試路由／定位校正，無產品修補 |
| 4 | Full reply 表格形狀；Type 具名選擇與切 pane 解除；Typeface 偏好 | [CLAUDE.md](/CLAUDE.md) Full reply／具名選擇規則、[configure.md](/docs/configure.md) Typeface 段 | V4：前 57＋本批四案，獨立整套 61 passed；Type 入口／Typeface 文件預設衝突未拍板 |
| 5 | Language 裝置偏好；Changes 深度偏好；Chat 實驗開關 | [configure.md](/docs/configure.md) Language／Changes／Experiments 段 | V4：前 61＋本批五案，改共同準備後獨立整套 66 passed；無產品修補 |
| 6 | Changes 清單的既有 fixture 顯示；idle 暫停出現／隱藏與恢復 | [changes.md](/docs/changes.md)、[CLAUDE.md](/CLAUDE.md) idle 規則、[ADR0007](/.adr/0007-the-idle-lock-is-a-pause-not-a-gate.md) | V4：前 66＋本批三案，獨立整套 69 passed；真 hidden／回前景自動恢復未驗，不以 frozen 當 hidden |

這些批次會順序執行；每批交獨立驗證後才接下批。具體 caseID、語義版本、原資料與需要的回歸範圍隨批次保存，不能把本表的排隊狀態當已執行。

## 未拍板與不下游推論

- Type 的入口：CLAUDE.md 寫長按 Send 開選單，現有 hook 註解要求不恢復長按、用具名 Type 控制。先只測雙方共同的具名選擇／切 pane 解除；不修成其中一方。
- Recent 方向：決策文字存在，尚未對回實際可操作入口，不從找不到舊檔名推論產品缺失。
- Full reply 短回覆：沿原契約的來源差額保留，不用現行結果反填期待。
- dashboard Shells：來源只明載 switcher 的 trailing 段，不把它變成另一個儀表流程；原 switcher 案仍保留。
- Typeface 的舊單測標題不是預設行為證據：清空 storage 的真正斷言是 aldrich，與 CLAUDE 一致。但第四批另讀到 [configure.md](/docs/configure.md) L376–377 真寫 Space Grotesk 是 default；這是另一個人寫來源的衝突，不能拿標題已釐清當它也已解除。第四批觀察目前 Aldrich 與原三選項／grotesk 保存；預設正確性未拍板，不改產品或文件來選邊。

## 回修與驗證契約

每個產品 bug 必須有文件來源、真 `ASSERTION_FAILED` 的修前證據、最小修正與同期待修後通過。locator／setup／fixture 組裝錯不當產品 bug；沒有 bug 也如實保存結果。

同一根因最多兩次修正；額度用盡列該項阻塞，其他不相依流程繼續。不改 expected、skip、timeout、retry 或 mock 真前端湊綠。缺資料須點名已查來源與缺欄位，不把未查當需要使用者準備。

產品修改只在本批直接影響範圍；跨服務／API／安全設計的修法先回 main 核授權。新隔離 build 只放本輪輸出目錄，不改 active `web/dist`／binary。功能修補同 commit 需 CHANGELOG Unreleased 一條，不 bump 版本。

worker 不下派 agent、不 Git 收尾。main 逐批對回原始 run／attempt／輸出／source，執行必要且不重複的獨立驗證；最後 task-verifier 核本輪清單與未驗界限，再 self-closeout 只收自有修改、留隔離分支。

## 逐批結果

第一批 worker 的單檔實跑已返回：run `01a104a9-dca7-7003-8dec-2a89d7c36eaa`，selected／executed／passed 11，各一個 attempt，exit 0；原 32 案因只選本批檔案沒有執行，不把它們算這輪 PASS。raw report 在 `.e2e/collie-loop-b01-1/report.json`。產品沒有修改，沿用原隔離 build。

main 讀新測試後發現 Focus 順序案例只剩一個 eligible workspace，不能分辨「只過濾」與「過濾後重排」。已要求從原資料補一個可觀察多群組順序的案例；這是原驗收缺口補強，不算產品 bug。補強後新增 Focus 多群組／多列順序案例，從原 dash-view 單測抽共享輸入，原 expect 保持；本批現在 12 案。獨立 verifier 已實跑整個目前 suite：run `01a104b9-3aa3-7757-b09e-5bedf16af8ca`，selected／executed／passed 44（原 32＋本批 12），failed／flaky／skipped 各 0，每案一個 attempt，exit 0；最近 dash-view 單檔 unit 18 passed。main 已直接解析 raw report，bad_results=[]。

原報告在 `.e2e/collie-loop-b01-verifier/report.json`。NAV/up 的 back step 通過且沒有 error，catch 未走；Keys trace 看到非空佇列與二次確認。Focus 的兩群／三列順序有實際 role/DOM 斷言，但最後 screencast 仍顯示切換前的 Panes，不能拿該圖宣稱畫面已確認，也不足以判假綠。保留這個影像缺口，不為取第二張圖重跑已正確的整批。

產品沒有改動；目前 header 的 `git hash-object` 仍是 `8cacbcf030a21477e927cece8a7649bdc3317ec0`。這是 Git source blob，不是應該在 browser artifact 裡找到的字串；未因 metadata 搜錯位置重建產品。第一批沒有確認產品 bug，不需要回修。

第二批獨立整套 run `01a104de-c3fd-77d7-9524-86703e5cebee`：selected／executed／passed 51（前 44＋本批七案），failed／flaky／skipped 各 0，每案一個 attempt，exit 0；raw report 在 `.e2e/collie-loop-b02-verifier/report.json`，main 已直接解析，bad_results=[]。Theme 只驗選項與 Light 重載後仍選中；Zen 驗出廠缺席、啟用、鏡像保留／composer 隱藏、浮動鈕與 Escape 恢復、reload 清 active 且設定保留。配色／System resolved、Zen active 跨 pane 重設未驗，不能拿 51 passed 掩蓋。

新檔原有 `ResponseWaiter.json(): Promise<unknown>` 被 oxlint no-unknown-returns 擋下。main 依已裝 SDK 出口改用 `@e2e-dev/web` 的 Browser，並用既有 LaunchersResponse 明確指定 json 泛型；整份 JSON 的原深度相等斷言保留。中途泛型推論造成 TS2339，指定具名回應後最新 web typecheck 通過；單檔 oxlint 通過。一次相對 binary 路徑找不到，改用既有絕對路徑執行，不新裝或跳過檢查。root typecheck 的獨立收據已通過，root 未受此型別調整影響。

型別修正前後用已裝 native esbuild 產生的 JavaScript 位元組相同，SHA-256 都是 `e3622cafc6d9dfaf67910d0bcdd88d0a19ccca6aaacb63cf133225f58332b6b7`；沒有改執行邏輯或重跑正確的 51 案，也沒有重 build／產品 patch。SDK 的 vcs.dirty=false 沒涵蓋當時未追蹤的新測試，身分另以實際 source／run／Git status 對回，不把該旗標當完整內容證明。

第三批 worker 的 Run A/B/C 保留：首輪路由以未解碼 `%3A` 比 pane id 而落入 fixture 501，另有多個同文 status；修 fixture 匹配後，最終 run `01a10502-e8db-7671-b130-a4321a0a3531` 是 5 passed／1 failed。唯一剩餘失敗是把 Plain 的原故障正文當成 alert 的 accessible name；screen 已有該句、原 response JSON 與 Plain dialog 都過，不能當產品 bug。worker 同根因兩次修正後停手。

main 依小於三行精確修正的例外，把單一 locator 改成已正向確認的 Plain dialog 內原文 exact text；原回應與 POST body 期待不變。Readonly 原先硬定文案出現兩次是目前畫面數量，不是人源；改成 status 的文本陣列包含字典精確拒絕句，保留沒有 launch POST，不用 first 或任意成功狀態。

兩受影響案的 main 窄 run `01a1050a-20ef-7f8f-8cff-cebaaf2a9228` 真通過，各一個 attempt，exit 0；raw report 在 `.e2e/collie-loop-b03-main-locators/report.json`。原兩 unit 的輸入抽共用、期待值保持，worker 最近單測 16 passed。產品沒有改；只 UI 與請求，不證 terminal 草稿、sidecar、真開 pane或server allowlist。

第三批獨立整套 run `01a1050e-4eb4-7a49-a21a-75c218991485`：跑前 `e2e list` 57 案／八檔，raw report 的 selected／executed／passed 57，failed／flaky／skipped 各 0，每案一個 attempt，exit 0；raw report 在 `.e2e/collie-loop-b03-verifier/report.json`。main 直接解析 report，bad_results=[]，attempt_statuses=['passed']。Plain 的原理由在具名 dialog 內可見；唯讀的精確拒絕句與零 launch POST 保持。最新 web typecheck 與本批四個程式檔的 oxlint 都 exit 0，原兩 unit 的最近收據仍是 16 passed，不重跑未改動的單測。產品沒有改，也沒有重 build；整輪尚未結案，接第四批。

第四批 worker run `01a10529-7d52-7ef2-bd16-b937b8d3320f`：本批 selected／executed／passed 四案，各一個 attempt、exit 0；raw report 在 `.e2e/441c4baf-4914-4f22-9f79-b221d7fa3600/report.json`，main 已直接解析。本批驗原 wrapped table 真 matcher 配對、結語只出現一次與尾列保留；具名 Type 的啟用／換 pane 解除且零 keys POST；三種 Typeface 選項與 grotesk 重載保存。修前 run `01a10528-11ef-7fff-8ce0-141c6b9f9da9` 是 Full reply 按鈕 accessible name 漏掉 from transcript，不是產品 bug。沒有產品修改或新 build。字型目前選中 Aldrich 是觀察，不代表已替衝突文件定案；long-press、short-wrap、hidden、真 journal 與字型實際排版未驗。獨立整套 run `01a1052f-832e-7107-88cd-8029b363d188`：跑前 list 九檔／61 案；raw report 的 selected／executed／passed 各 61，failed／flaky／skipped 各 0，每案一個 attempt，599 個 step 都通過，exit 0。報告在 `.e2e/collie-loop-b04-verifier/report.json`，main 直接解析 bad_results=[]、bad_steps=[]。原表格三份字面與抽取前相等，原 unit 期待保持；最近兩個 unit 38 passed，最新 web typecheck／四檔 lint exit 0。Typeface 的文件預設衝突仍未解除；接第五批，不把四案通過當整輪結案。

第五批首 run `01a10540-2d15-78cb-a594-761861b9090b`（`.e2e/collie-loop-b05-r1/report.json`）：五案中 Changes 兩案、Chat 兩案通過，語言 reload 一案失敗。繁中切換後的「外觀／語言／終端機鏡像輸出不會被翻譯。」都已通過，reload 後同 URL 卻回到 Appearance／Language value=en；main 直接對 raw steps 與 failure screen 核實。共享 `pinLocale` 的 addInitScript 每次載入都寫 en，是 setup 覆寫，不是產品語言保存失效。

main 只改 TesterArmy 的 `fixtures.ts` 兩行：去掉 pinLocale import、在空白 bootstrap 寫一次既有 locale key=en，再首次開產品。共有 Playwright helper、產品與期待、tour/API/origin/SW/proxy 不變。worker 只重跑語言案，新 run `01a10543-f4ca-7643-ad42-6e3aec413fee`（`.e2e/collie-loop-b05-r2/report.json`）selected 一案、一個 attempt、17 steps 都通過、exit 0，main 已直接解析；其餘未選的 skip 不是整套結果。最新真正 web typecheck 與準備檔／新 E2E 的局部 lint exit 0；前面誤用 runner 本地 tsconfig 的 Node 型別缺失保留為檢查入口限制，不修無關檔。沒有產品修改或新 build。共同準備改動影響舊案例，獨立整套 run `01a10548-4060-71bb-a1ed-a566363615e0`（`.e2e/collie-loop-b05-verifier/report.json`）在跑前 list 十檔／66 案後實跑：discovered／selected／executed／passed 各 66，failed／flaky／skipped 各 0，每案一個 attempt、697 steps 都通過、exit 0；main 已直接解析 bad_results=[]、bad_steps=[]。繁中 reload 後原第 89 行仍是 zh-TW，關掉 Changes 搜尋後深度四仍勾著／停用，再開保留；Chat 預設關、打開與 reload 保留，只驗 menu 的 Terminal view 列，不宣稱真 Chat 或 git 搜尋。準備 diff 恰是兩行，共有 api.ts 不變；不同入口的本地 tsconfig 缺失未修。接第六批，不把目前 66 passed 當整輪結案。

第六批 worker 的最終 run `01a10559-5dd3-77ce-a923-aa90063ab2cf`（`.e2e/b06-a0f63d44-8c32-40aa-9e53-idlefinal/report.json`）：selected／executed／passed 三案，各一個 attempt、exit 0，main 已全文讀新檔／報告並直接解析；其他 66 案未選，不當整套通過。Changes 的 pane／dashboard 入口都看到原 fixture 的 checkout.tsx、Modified、+3／−1，過程零非讀 HTTP，只證網頁。缺 paneRepo 的原 fixture 不增加欄位來測 This pane。

Idle 在空白 bootstrap／產品首次開啟前安裝已裝 Playwright 時鐘，跳過原 `30 * 60 * 1000` 毫秒後可見 Paused；按 Tap to resume 後 URL 與原 `keep this draft` 保留，不用 reload。後置公開 CDP frozen 探測實際是 `{"before":"visible","after":"visible"}`，沒有真 hidden，所以 hidden 不鎖／回前景自動恢復未驗，也未假造 getter 或事件。更早／更晚的閾值邊界未另測。前面失敗只在同步 URL 讀取、heading 精確名稱與 union 型別，沒有產品修補或新 build；最終 web typecheck／局部 lint 的收據交獨立 verifier 核。獨立整套 run `01a10560-abc7-776b-b130-985c4fddf4fa`（`.e2e/collie-loop-b06-verifier/report.json`）無 filter：discovered／selected／executed／passed 各 69，failed／flaky／skipped 各 0，每案一個 attempt、741 steps 都通過、exit 0；main 已直接解析 bad_results=[]、bad_steps=[]。跑前來源枚舉是十一檔／67 個直寫 test 加兩個 waitWhatCases；verifier 沒跑前置 SDK list，main 事後另跑 SDK list 得十一檔／69 案，逐案與 raw 比對 registered_only=[]、results_only=[]，不冒稱事後清單是跑前快照，也不重跑正確 SDK。最後真正 web typecheck 非 error 收據與 OX_EXIT:0 已由 main 直接查 worker JSONL。沒有產品修改。六批可觀察項已有結果，來源衝突與環境未驗保留；最後還須 task-verifier 與自有 Git 收尾，不預填整輪結案。

上一小包的成功不冒充本輪所有候選已測；後續各批在這裡追加，不覆寫第一包歷史。
