# 故意錯預期的負向控制

這次只檢查框架不會把錯 expected 判成 PASS，不改產品、不修改正常案例期待。

## 方法

沿首案 prepared fixture 開真 Chromium，到 `/pane/w1:p1`，開 Agent palette 選 `/status`。故意斷言 composer 值應為 `/intentionally-wrong`。控制檔置於忽略的 `.e2e/negative-control.e2e.ts`，獨立 config 只選此案，沒有加入正常 suite，沒有 expected-fail 或 skip。

命令：停用 telemetry 與 DNT，設定本輪隔離 build 和原生 esbuild 路徑後，執行 `npx --no-install e2e run --config .e2e/negative-control.config.ts`。config 載入正式 runner 設定，只改本案檔案選取與獨立 output；其餘含零 retry 不變。

## 真實輸出

```text
run 01a10344-37fd-75e3-afb3-447098be3199
ASSERTION_FAILED: expect.toHaveValue failed
locator: getByRole("textbox", name: "Type a reply…")
expected: value "/intentionally-wrong"
observed: value "/status" (match count 1)
Tests 1 failed | 0 passed (1)
exit code 1
```

預期看到錯 expected 真 FAIL；實際看到正常 `/status` 而斷言失敗，匹配。這是 V2 的負向控制證據，不是產品 bug，不計入正常案例成功數，也沒有故意破壞產品驗完整補丁失效。

原 report、screen、trace 保存在 `.e2e/negative-control/`。控制 source 的關鍵斷言就是 `expect(...textbox...).toHaveValue("/intentionally-wrong")`，不能把失敗退出改成成功。
