import { expect } from "e2e";
import { surfaceOf } from "@e2e-dev/web";

import { en } from "../../src/lib/i18n/messages/en.ts";
import { fixtureSnapshot } from "../../src/test/handlers.ts";
import {
  newestAttentionAgents,
  operatorClear,
  operatorDeploy,
  recapDescription,
  waitWhatIdleRows,
  waitWhatRecapRows,
} from "../../src/test/fork-regression-data.ts";
import { engine } from "./engine.ts";
import { test } from "./fixtures.ts";

function page() {
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  return live.page();
}

async function paneText(text: string): Promise<void> {
  await page().route((url) => /^\/api\/pane\/[^/]+$/.test(url.pathname), (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ paneId: "w1:p1", text, truncated: false, revision: 1 }),
  }));
}

async function operatorRows(rows: typeof operatorDeploy[]): Promise<void> {
  await page().route("**/api/config", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ push: false, vapidPublicKey: "", operatorCommands: rows }),
  }));
}

const waitWhatCases = [
  { id: "waitwhat-idle-hidden/v1", rows: waitWhatIdleRows, hidden: ["wait what"] },
  { id: "waitwhat-retelling-hidden/v1", rows: waitWhatRecapRows, hidden: ["wait what", "recap ·", "退回原因：", "重講內容"] },
];
for (const c of waitWhatCases) {
  test(`${c.id} — the captured mod band stays off the mirror`, async ({ app, screen }) => {
    await paneText(c.rows.join("\n"));
    await app.open("/pane/w1:p1");
    await expect(screen.getByText("Done.", { exact: false })).toBeVisible();
    for (const text of c.hidden) {
      await expect(screen.getByText(text, { exact: false })).toHaveCount(0);
    }
    await app.screenshot(c.id.replaceAll("/", "-"));
  });
}

test("operator-claude-merge/v1 — custom rows do not hide the reference catalog", async ({ app, screen }) => {
  await operatorRows([operatorDeploy]);
  await app.open("/pane/w1:p1");
  const writes: string[] = [];
  page().on("request", (request) => {
    if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/")) writes.push(request.url());
  });
  await screen.getByRole("button", en["composer.controls.agent"], { exact: true }).tap();
  const palette = screen.getByRole("dialog", en["commands.title"]);
  await expect(palette).toBeVisible();
  const buttons = await palette.getByRole("button", /^\//).allTextContents();
  expect(buttons[0]).toContain("/deploy");
  await expect(palette.getByRole("button", /^\/compact\s/)).toBeVisible();
  await palette.getByRole("button", /^\/deploy\s/).tap();
  await expect(screen.getByRole("textbox", en["composer.placeholder.reply"])).toHaveValue("/deploy");
  await expect(palette).toBeHidden();
  expect(writes).toEqual([]);
});

test("operator-exact-override/v1 — one operator row controls the exact-name presentation", async ({ app, screen }) => {
  await operatorRows([operatorClear]);
  await app.open("/pane/w1:p1");
  const writes: string[] = [];
  page().on("request", (request) => {
    if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/")) writes.push(request.url());
  });
  await screen.getByRole("button", en["composer.controls.agent"], { exact: true }).tap();
  const palette = screen.getByRole("dialog", en["commands.title"]);
  const clear = palette.getByRole("button", /^\/clear\s/);
  await expect(clear).toHaveCount(1);
  await expect(clear).toContainText("Clear after saving notes");
  await expect(clear).toContainText("[note]");
  await clear.tap();
  await expect(screen.getByRole("textbox", en["composer.placeholder.reply"])).toHaveValue("/clear ");
  expect(writes).toEqual([]);
});

test("description-recap-display/v1 — the pane and switcher render the supplied description", async ({ app, screen }) => {
  const snapshot = structuredClone(fixtureSnapshot);
  const claude = snapshot.agents[0];
  if (claude === undefined) throw new Error("The existing claude fixture is absent");
  claude.description = recapDescription;
  await page().route("**/api/snapshot*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) }));
  await app.open("/pane/w1:p1");
  await expect(screen.getByText("讀取 hello.txt", { exact: true })).toBeVisible();
  await expect(screen.getByText("已讀取檔案", { exact: true })).toBeVisible();
  await expect(screen.getByText("等待你的下一個指令", { exact: true })).toBeVisible();
  await screen.getByRole("button", en["chat.switcher.aria"], { exact: true }).tap();
  const dialog = screen.getByRole("dialog", en["chat.switcher.title"]);
  const row = dialog.getByRole("button", /claude/);
  await expect(row).toContainText("已讀取檔案");
  const text = (await row.textContent()) ?? "";
  expect(text.indexOf("claude")).toBeGreaterThanOrEqual(0);
  expect(text.indexOf("claude")).toBeLessThan(text.indexOf("已讀取檔案"));
});

test("attention-newest-first/v1 — the newest state change comes first within Needs you", async ({ app, screen }) => {
  const snapshot = structuredClone(fixtureSnapshot);
  snapshot.agents = structuredClone(newestAttentionAgents);
  await page().route("**/api/snapshot*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) }));
  await app.open("/");
  await screen.getByRole("button", `3 ${en["status.label.blocked"]} ${en["chat.switcher.title"]}`, { exact: true }).tap();
  const dialog = screen.getByRole("dialog", en["chat.switcher.title"]);
  await expect(dialog.getByRole("heading", /^needs you/i)).toBeVisible();
  const rows = await dialog.getByRole("button", /proj/).all();
  const ids = await Promise.all(rows.map((row) => row.getAttribute("id")));
  expect(ids).toEqual(["switch-row-__new", "switch-row-__mid", "switch-row-__old"]);
});
