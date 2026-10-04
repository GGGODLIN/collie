# supplemental-web/v1

## 範圍與定案

這批補回可上游化的一般 fork patch，不因 FORK.md 把 account switch 分出 personal retell 條目就排除。沿本題人 a 與「我要去睡了，就交給你跑完」的網頁委任。只採 CHANGELOG L697–698/L715–722、CLAUDE.md L534–540；code-only 或衝突留待確認。iOS、真換帳號／terminal／bridge journal I/O 不執行。

共同前置：真 Chromium、隔離 web build、en、fresh context、原既有 API fixture、無model/cache、無外連。原單測資料抽到共用 test fixture，不自造 payload，不 mock 前端 matcher/component。必要前置如 hasSession/狀態來自原案例資料，不當新正確答案。

## Account（3 案）

- account-idle-sent/v1：CHANGELOG L698。已有 Personal 帳號的 idle Claude，開 Pane actions→Switch account→Personal，網頁發一個 switch-account 請求、interrupt=false，並顯示「switch已送出」文案。不宣稱 Claude 已退出/resume。
- account-working-confirm/v1：同來源。working 時第一次選帳號不發請求；明確第二次 interrupt 確認才發 interrupt=true。不能提前送出，不真中斷程序。
- account-draft-refusal/v1：同來源與59ca0222的commit本文。收到 account.draft_present 拒絕後顯示未送文字原因，不發清除或第二次重送。只前端拒絕回應，不宣稱 bridge 完全沒有打字。

資料：原 pane-account-retell.test.tsx 的 [Personal]、既有 fixtureAgents[0] clone；原模組拒絕資料若不存在，就用既有 API error domain row 來源抽成共用fixture，標來源，不能編造另一個產品錯誤碼。

## List approval（5 案）

CHANGELOG L697：blocked permission 列可直接讀與回答原畫面選項，prompt改變關 sheet；question/unknown開 pane。

- list-permission-sheet/v1：既有 claude--permission-bash.txt；點blocked列，停在dashboard且顯示 Permission required、mkfifo fixture-fifo 與既有 Yes/No 等選項，沒有寫入。
- list-choice-one-post/v1：同capture，點一個原畫面印出的選項，只有一個 keys POST，關sheet、留dashboard。不把某個unit按鍵號當獨立期待。
- list-prompt-changed/v1：同capture與原unit既有替換 mkfifo fixture-fifo→rm other-file，等正常revalidate後sheet關、零keys POST。
- list-question-opens-pane/v1：既有 claude--select-menu.txt；點blocked列開pane，不做permission回答。
- list-unknown-opens-pane/v1：原unit已有 An unknown modal\n1. Yes\n2. No；同上一條。資料抽到共用fixture，非任意新未知畫面。

不驗真terminal是否收下keys、host/session safety、plan/trust或read-only等未定其他分支。

## Full reply（至少5個必要分支，資料形狀可獨立具名）

CLAUDE.md L534–540、CHANGELOG L715–722：tail identity相符且head不在畫面，配prompt與reply；身份不合或缺prompt留下mirror；wrapped table/link-label/code fence/HTML/entity不應破壞匹配。

- full-reply-paired/v1：原agent-chat單測的long REPLY/PROMPT/SCREEN/AFTER，Full reply可見且配對原prompt；鏡像不重複卡片覆蓋的tail，仍留reply後的git字串。
- full-reply-no-prompt/v1：同reply但原案例history沒有user，沒有reply-only卡，鏡像保留tail。
- full-reply-identity-miss/v1：原單測的an entirely different screen，history仍原對話，不能畫Full reply。
- full-reply-painted-forms/v1：原latest-reply單測的wrappedtable、link-label、bash fence、HTML/code-span資料。可以各自獨立test，必須維持head-offscreen、tailidentity的共同前置；不放寬為只有字串存在就PASS。
- full-reply-entity-no-throw/v1：原單測尾端 &#x110000; / &#1114112; 原文；頁面不拋、tail可匹配、仍可畫卡。不從測試結果倒推解碼字串。

History stub只提供原journal輸入；真webbundle自己算head/tail及卡片，不能stub一個matched=true結果。只前端，不算bridge讀journal。短回覆always-wrap與CLAUDE衝突、沒有pairedjournal的settle、isMeta與跨history舊頁等尚未核定資料者留缺口，不自批／修改產品。

## 交接

映射 supplemental-web.e2e.ts 與必要的共用 fork-supplement-data.ts。不修改其他case的預期；每案有獨立ID、狀態與本輪證據。不加skip/retry/timeout掩蓋失敗。接口接線修正不改語義；改重要前置必須立新版本並記委任下的來源判斷。
