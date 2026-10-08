import type { Screen } from "e2e";
import { expect } from "e2e";
import { surfaceOf } from "@e2e-dev/web";

import { t } from "../../src/lib/i18n/index.ts";
import { en } from "../../src/lib/i18n/messages/en.ts";
import { fixtureSnapshot } from "../../src/test/handlers.ts";
import { focusFilterOrderAgents } from "../../src/test/sweep-loop-navigation-data.ts";
import { engine } from "./engine.ts";
import { test } from "./fixtures.ts";

// Loop batch 01. Expectations come from DESIGN.md §12, ADR 0067, ADR 0005,
// and ADR 0066 as amended by ADR 0085 (Needs you filters without sorting) and
// ADR 0070 (a Pinned group is drawn only for pins the operator stored). The
// default fixture stores none, so this file does not open the pin menu.
// Key taps are the composer unit's own: Ctrl, then Tab.

const PANE_A = /\/pane\/w1(?::|%3A)p1$/u;
const PANE_B = /\/pane\/w2(?::|%3A)p1$/u;
const DASHBOARD = "/";
const NEEDS_YOU = en["home.needsYouOnly"];
const CHANGES_MARK = "+10 −2";
const DISCARD_ONE = "Tap again to discard 1 queued key";
const CHIP = "Remove Ctrl Tab";

interface Openable {
  open: (path?: string) => Promise<void>;
}

function page() {
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  return live.page();
}

function watchKeyWrites(): string[] {
  const writes: string[] = [];
  page().context().on("request", (request) => {
    if (request.method() === "GET") return;
    const path = decodeURIComponent(new URL(request.url()).pathname);
    if (path.endsWith("/keys") || path.endsWith("/reply")) writes.push(`${request.method()} ${path}`);
  });
  return writes;
}

function footer(screen: Screen) {
  return screen.getByRole("navigation", en["home.tabs.aria"]);
}

async function openDashboard(app: Openable, screen: Screen): Promise<void> {
  await app.open(DASHBOARD);
  await expect(footer(screen).getByRole("button", new RegExp(`^${en["home.tabs.dashboard"]}(?:\\s*,|$)`, "u"))).toBeVisible();
}

async function openClaudePane(app: Openable, screen: Screen): Promise<void> {
  await openDashboard(app, screen);
  await screen.getByRole("button", /^claude logo claude/u).tap();
}

async function openKeys(app: Openable, screen: Screen): Promise<void> {
  await openClaudePane(app, screen);
  const keys = screen.getByRole("button", en["composer.controls.keys"]);
  await expect(keys).toBeVisible();
  await keys.tap();
  await expect(screen.getByRole("button", "Esc")).toBeVisible();
}

test("NAV-BACK/down — a pane opened from the dashboard is one browser back from it", async ({ app, screen, browser }) => {
  await openClaudePane(app, screen);
  await expect(browser).toHaveURL(PANE_A);
  await expect(screen.getByRole("button", t("nav.home.aria.default"))).toBeVisible();
  await browser.back();
  await expect(browser).toHaveURL(DASHBOARD);
  await expect(footer(screen).getByRole("button", new RegExp(`^${en["home.tabs.dashboard"]}(?:\\s*,|$)`, "u"))).toBeVisible();
});

test("NAV-BACK/side — switching panes replaces, so browser back is not the pane just left", async ({ app, screen, browser }) => {
  await openClaudePane(app, screen);
  await expect(browser).toHaveURL(PANE_A);
  await screen.getByRole("button", /^Switch pane/u).tap();
  const switched = screen.getByRole("dialog").getByRole("button", /^codex logo codex/u);
  await expect(switched).toBeVisible();
  await switched.tap();
  await expect(browser).toHaveURL(PANE_B);
  await browser.back();
  await expect(browser).toHaveURL(DASHBOARD);
  await expect(browser).not.toHaveURL(PANE_A);
});

test("NAV-BACK/up — the home control steps back and a further browser back does not re-enter the pane", async ({ app, screen, browser }) => {
  await openClaudePane(app, screen);
  await expect(browser).toHaveURL(PANE_A);
  await screen.getByRole("button", t("nav.home.aria.default")).tap();
  await expect(browser).toHaveURL(DASHBOARD);
  try {
    await browser.back();
  } catch (error) {
    const href = await browser.url();
    if (/\/pane\//u.test(href)) throw error;
  }
  expect(await browser.url()).not.toMatch(/\/pane\//u);
});

test("NAV-BACK/sheet — pane actions open and close without a history entry", async ({ app, screen, browser }) => {
  await openClaudePane(app, screen);
  await expect(browser).toHaveURL(PANE_A);
  await screen.getByRole("button", en["chat.paneMenu.aria"]).tap();
  const sheet = screen.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(browser).toHaveURL(PANE_A);
  await sheet.getByRole("button", en["common.closeAria"]).tap();
  await expect(sheet).toBeHidden();
  await expect(browser).toHaveURL(PANE_A);
});

test("NAV-BACK/sheet-back — browser back with the sheet open leaves the pane instead of only closing the sheet", async ({ app, screen, browser }) => {
  await openClaudePane(app, screen);
  await expect(browser).toHaveURL(PANE_A);
  await screen.getByRole("button", en["chat.paneMenu.aria"]).tap();
  await expect(screen.getByRole("dialog")).toBeVisible();
  await browser.back();
  await expect(browser).toHaveURL(DASHBOARD);
  await expect(footer(screen).getByRole("button", new RegExp(`^${en["home.tabs.dashboard"]}(?:\\s*,|$)`, "u"))).toBeVisible();
});

test("KEYS-Q/empty — an empty Keys dock closes on the first tap and posts no keys or reply", async ({ app, screen }) => {
  const writes = watchKeyWrites();
  await openKeys(app, screen);
  await screen.getByRole("button", "Close Keys").tap();
  await expect(screen.getByRole("button", "Esc")).toBeHidden();
  await expect(screen.getByText(DISCARD_ONE)).toBeHidden();
  expect(writes).toEqual([]);
});

test("KEYS-Q/discard-close — the first close keeps the chord and names the confirm; the second discards it", async ({ app, screen }) => {
  const writes = watchKeyWrites();
  await openKeys(app, screen);
  await screen.getByRole("button", "Ctrl").tap();
  await screen.getByRole("button", "Tab").tap();
  const chip = screen.getByRole("button", CHIP);
  await expect(chip).toBeVisible();
  await screen.getByRole("button", "Close Keys").tap();
  await expect(chip).toBeVisible();
  await expect(screen.getByText(DISCARD_ONE)).toBeVisible();
  expect(writes).toEqual([]);
  await screen.getByRole("button", "Close Keys").tap();
  await expect(screen.getByRole("button", "Esc")).toBeHidden();
  await expect(chip).toBeHidden();
  await screen.getByRole("button", en["composer.controls.keys"]).tap();
  await expect(screen.getByRole("button", "Esc")).toBeVisible();
  await expect(screen.getByRole("button", CHIP)).toBeHidden();
  expect(writes).toEqual([]);
});

test("KEYS-Q/discard-quick — Quick is the same choke point as the close control", async ({ app, screen }) => {
  const writes = watchKeyWrites();
  await openKeys(app, screen);
  await screen.getByRole("button", "Ctrl").tap();
  await screen.getByRole("button", "Tab").tap();
  const chip = screen.getByRole("button", CHIP);
  await expect(chip).toBeVisible();
  const quick = screen.getByRole("button", en["composer.controls.quick"]);
  await quick.tap();
  await expect(chip).toBeVisible();
  await expect(screen.getByText(DISCARD_ONE)).toBeVisible();
  expect(writes).toEqual([]);
  await quick.tap();
  await expect(chip).toBeHidden();
  await expect(screen.getByRole("button", "Close Quick")).toBeVisible();
  expect(writes).toEqual([]);
});

test("KEYS-Q/armed-empty — a lone Ctrl with no chip closes on the first tap", async ({ app, screen }) => {
  const writes = watchKeyWrites();
  await openKeys(app, screen);
  const ctrl = screen.getByRole("button", "Ctrl");
  await ctrl.tap();
  await expect(ctrl).toHaveAttribute("aria-pressed", "true");
  await expect(screen.getByRole("button", CHIP)).toBeHidden();
  await screen.getByRole("button", "Close Keys").tap();
  await expect(screen.getByRole("button", "Esc")).toBeHidden();
  await expect(screen.getByText(DISCARD_ONE)).toBeHidden();
  expect(writes).toEqual([]);
});

test("DASH-FOOT/tabs/v2 — Dashboard filters with Needs you, and Files keeps the workspace change counts", async ({ app, screen }) => {
  await openDashboard(app, screen);
  const dashboard = footer(screen).getByRole("button", new RegExp(`^${en["home.tabs.dashboard"]}(?:\\s*,|$)`, "u"));
  const needsYou = screen.getByRole("button", NEEDS_YOU);
  const files = footer(screen).getByRole("button", en["files.title"]);
  await expect(footer(screen).getByRole("button")).toHaveCount(2);
  await expect(dashboard).toHaveAttribute("aria-current", "page");
  await expect(needsYou).toHaveAttribute("aria-pressed", "false");
  await expect(screen.getByRole("heading", "webapp")).toBeVisible();
  await expect(screen.getByRole("heading", "collie")).toBeVisible();

  await needsYou.tap();
  await expect(needsYou).toHaveAttribute("aria-pressed", "true");
  await expect(dashboard).toHaveAttribute("aria-current", "page");
  await expect(screen.getByRole("heading", "webapp")).toBeVisible();
  await expect(screen.getByRole("main").getByRole("button", /^claude logo claude/u)).toBeVisible();

  await files.tap();
  await expect(files).toHaveAttribute("aria-current", "page");
  await expect(needsYou).toHaveCount(0);
  const list = screen.getByRole("list", en["home.changes.listAria"]);
  await expect(list).toBeVisible();
  const rows = list.getByRole("button");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("webapp");
  await expect(rows.nth(0)).toContainText("5 files");
  await expect(rows.nth(0)).toContainText(CHANGES_MARK);
  await expect(rows.nth(1)).toContainText("collie");
  await expect(rows.nth(1)).toContainText("5 files");
});

test("DASH-FOOT/focus-filter/v2 — Needs you keeps the fixture's workspace order and drops the working one", async ({ app, screen }) => {
  await openDashboard(app, screen);
  const before = await screen.getByRole("main").getByRole("heading", /^webapp$|^collie$/u).allTextContents();
  expect(before.filter((name) => name === "webapp" || name === "collie")).toEqual(["webapp", "collie"]);
  await screen.getByRole("button", NEEDS_YOU).tap();
  await expect(screen.getByRole("button", NEEDS_YOU)).toHaveAttribute("aria-pressed", "true");
  await expect(screen.getByRole("heading", "webapp")).toBeVisible();
  await expect(screen.getByRole("main").getByRole("button", /^claude logo claude/u)).toBeVisible();
  const after = await screen.getByRole("main").getByRole("heading", /^webapp$|^collie$/u).allTextContents();
  expect(after.filter((name) => name === "webapp" || name === "collie")).toEqual(["webapp"]);
  await expect(screen.getByRole("heading", "collie")).toHaveCount(0);
  await expect(screen.getByRole("navigation", en["space.strip.title"]).getByRole("button", /collie/u)).toBeVisible();
});

// dash-view.test.ts writes the order this herd must keep: groups ws1 then ws3,
// and inside ws3 the unseen done pane (w3:p1, lastActiveAt 20) before the
// blocked pane (w3:p2). A status sort would swap those two rows; a recency
// sort of the groups would put ws3 first. The names below are that written
// order, not a sort of the live list.
test("DASH-FOOT/focus-order/v2 — Needs you keeps ws1 before ws3 and the unseen row ahead of the later blocked row", async ({ app, screen }) => {
  const snapshot = structuredClone(fixtureSnapshot);
  snapshot.agents = structuredClone(focusFilterOrderAgents);
  snapshot.shellPanes = [];
  await page().route("**/api/snapshot*", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(snapshot),
  }));
  await openDashboard(app, screen);
  await screen.getByRole("button", NEEDS_YOU).tap();
  await expect(screen.getByRole("button", NEEDS_YOU)).toHaveAttribute("aria-pressed", "true");
  await expect(screen.getByRole("heading", "ws1")).toBeVisible();
  await expect(screen.getByRole("heading", "ws3")).toBeVisible();
  const headings = await screen.getByRole("main").getByRole("heading", /^ws[123]$/u).allTextContents();
  expect(headings).toEqual(["ws1", "ws3"]);
  const rows = screen.getByRole("main").getByRole("button", /^claude logo claude/u);
  await expect(rows).toHaveCount(3);
  const unseen = en["home.row.unseen"];
  await expect(rows.nth(1).getByRole("img", unseen)).toBeVisible();
  await expect(rows.nth(0).getByRole("img", unseen)).toHaveCount(0);
  await expect(rows.nth(2).getByRole("img", unseen)).toHaveCount(0);
  await expect(screen.getByRole("heading", "ws2")).toHaveCount(0);
});
