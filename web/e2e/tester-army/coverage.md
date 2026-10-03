# Fork 網頁回歸涵蓋表

範圍來自 FORK.md、ADR 9001–9005、CHANGELOG 的 fork 條目，不从寫出的測試反推分母。這張表不宣稱每個分支都已覆蓋。逐案真實結果另存 runs/；有腳本不等於通過。

## 來源對應

人寫期待與測試觀察分開；API stub 不能證明 bridge 或 terminal 的效果。

| 補丁群組 | 人寫來源 | 已保存／建立中的網頁觀察 | 未驗或排除 |
| --- | --- | --- | --- |
| 品牌字 | [FORK.md](/FORK.md) L32–39 | title-dash/v3：已有具名 mux 的 dashboard 真可見 | 無 mux 的 v1/v2 失敗保留，沒修產品；pane 隱藏分支未另建案 |
| wait-what band | [FORK.md](/FORK.md) L76–86、[CHANGELOG.md](/CHANGELOG.md) L710 | idle／retelling 兩形狀；真網頁保留 Done、拿掉 band | 其他負例仍只有既有單測，不算本批 E2E |
| Claude operator 合併 | [ADR 9001](/.adr/9001-claude-operator-commands-join-the-reference-catalog.md) | custom 先出現、reference 留下、同名只有一列、描述與參數正確 | 危險分類下限、非 Claude 替換、bar operator two-tap 未新增網頁案；不驗檔案重讀 |
| palette 只填文字 | [ADR 9002](/.adr/9002-the-agent-palette-stages-never-sends.md) | 無參數、有參數尾空白、補參數、危險列零寫入；明確 Send 才 reply；bar Compact 直送 | 真 terminal 不在範圍 |
| attention 清單 | [ADR 9003](/.adr/9003-the-switcher-orders-a-section-by-its-latest-state-change.md)、[ADR 9004](/.adr/9004-both-pane-switcher-entries-use-attention.md)、CHANGELOG L705–709 | 兩個 pane switcher 入口、段序、段內最新在前、開啟時固定與重開更新、dashboard 仍按位置、in-pane Shells 在後 | session switcher 的狀態點／排序未新增；平手／無 timestamp／關閉 pane 未新增；Recent 方向切換與 dashboard Shells 的來源差額待確認；Launch 無輸入 |
| retell | [ADR 9005](/.adr/9005-retell-is-a-one-shot-operator-child.md) | 未設定時 Pane actions 沒有 Plain/Lost | 配置後正例未新增；sidecar、argv、timeout、session 檢查、大小限制不由 stub 驗 |
| recap description | [FORK.md](/FORK.md) L41–51、CHANGELOG L693/L695–696/L717 | pane 的 goal/now/next；switcher name 在前、description 在後 | resolver、檔案優先序、忙碌時讀 journal 不由 stub 驗 |
| fork 更新來源 | FORK.md L88–105、CHANGELOG L711 | 不偽造 URL 當 E2E | CLI／bridge／release 層；不在這批 web 測試 |
| fork live suite | FORK.md L66–74、[CLAUDE.md](/CLAUDE.md) Fork-only live e2e | 不執行 | 使用者未准真 bridge／Herdr terminal，排除 |
| account switch | CHANGELOG L698 | 本批核定 idle/sent、working 第二次確認；建立與實跑狀態见 runs/ | draft refusal 缺共用原輸入，未新增；不驗真 Claude 退出或 resume |
| list approval | CHANGELOG L697 | permission sheet、單次 keys 請求、prompt 改變關閉、question／unknown 開 pane；狀態見 runs/ | plan/trust、read-only、host/session 與真 terminal 回答未新增 |
| Full reply | CLAUDE.md L534–540、CHANGELOG L715–722 | 真 web matcher 的配對／缺 prompt／身份不合；狀態見 runs/ | painted table/link/fence/HTML/entity 尚未組成 browser 情境；isMeta、翻舊頁、settle 未新增；short always-wrap 與文件衝突，待確認 |

## 原單測資料復用

資料抽取保留原斷言，不把單測通過算成 E2E。

| 共用資料 | 原來源（抽取前） | 消費者 |
| --- | --- | --- |
| waitWhatIdleRows／waitWhatRecapRows／box／header | waitwhat-band.test.ts L8–37；L17 記原 live pane 形狀 | 原單測＋data-backed-web |
| operatorDeploy／operatorClear／operatorUnscoped | agent-commands.test.ts L164–228 | 原單測＋data-backed-web |
| recapDescription／promptDescription | pane-description.test.tsx L10–33 | 原單測＋data-backed-web |
| regressionAgent／newestAttentionAgents | triage.test.ts 原 factory 與 L122–126 | 原單測＋data-backed-web；固定 timestamp 只驗前端排序 |
| namedHeaderConfig | app-header.test.tsx 原 L263–267 | 原單測＋core-web title/v3；前兩版無 mux 失敗不消失 |
| accountsConfig／account labels／switchAccepted | pane-account-retell.test.tsx 原 L27–41/L59/L70 | 原單測與 supplemental；原 POST 斷言保持字面值 |
| unknownModalScreen／changedPermissionScreen | list-approval.test.tsx 原 L113/L145/L169 | 原單測與 supplemental；raw permission/question 仍直接讀原 capture |
| fullReply／fullReplyPrompt／fullReplyAfter／fullReplyHistory | agent-chat.test.tsx 原 L2656–2710 | 原單測用 REPLY/PROMPT/AFTER 別名，斷言與 eager SCREEN 不變；supplemental 的真 web matcher |

## 執行邊界

本輪只驗 Chromium phone、en、loopback 的真網頁；iOS 按使用者明示跳過。tablet、Safari、LLM、cache、真 backend、上游合併均未驗。本表的未驗列是交付限制，不是 PASS 或 skip。

沒有可部署的產品修改，故不部署 active Collie。不合上游、不開 release 或上游 PR。未來合併後重建當前 checkout，再用原期待重跑；不要從新版結果重寫期待。
