import { surfaceOf } from "@e2e-dev/web";
import type { Screen } from "e2e";
import { expect } from "e2e";

import { en } from "../../src/lib/i18n/messages/en.ts";
import { fixtureChanges, fixtureWorkspaces } from "../../src/test/handlers.ts";
import { engine } from "./engine.ts";
import { test } from "./fixtures.ts";

// Loop batch 06. CHG-LIST reads docs/changes.md: two entries, list status words,
// and read-only. IDLE reads ADR 0007 and use-idle-lock.ts: a visible untouched
// page pauses at DEFAULT_IDLE_MS, the router stays mounted, and resume is the
// cover's own control. The draft is the composer unit's "keep this draft".
// Hidden is not simulated: this file only records native visibilityState.

const DRAFT = "keep this draft";
// use-idle-lock.ts DEFAULT_IDLE_MS. Not imported: the constant is module-private.
const DEADLINE_MS = 30 * 60 * 1000;
const CLOCK_TIME = "2026-01-01T00:00:00.000Z";
const PANE_URL = /\/pane\/w1(?::|%3A)p1$/u;
const WEBAPP = fixtureWorkspaces[0];
if (!fixtureChanges.available) throw new Error("fixtureChanges is unavailable");
const CHECKOUT = fixtureChanges.repos[0]?.files[0];

if (WEBAPP === undefined || WEBAPP.label !== "webapp" || WEBAPP.workspaceId !== "w1") {
  throw new Error("fixture workspace 0 is no longer webapp/w1");
}
if (CHECKOUT === undefined || CHECKOUT.path !== "src/routes/checkout.tsx" || CHECKOUT.status !== "M" || CHECKOUT.added !== 3 || CHECKOUT.removed !== 1) {
  throw new Error("fixtureChanges no longer leads with src/routes/checkout.tsx M +3 −1");
}

interface Openable {
  open: (path?: string) => Promise<void>;
}

function page() {
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  return live.page();
}

function watchWrites(): string[] {
  const writes: string[] = [];
  page().context().on("request", (request) => {
    if (request.method() === "GET" || request.method() === "HEAD") return;
    const path = decodeURIComponent(new URL(request.url()).pathname);
    writes.push(`${request.method()} ${path}`);
  });
  return writes;
}

function footer(screen: Screen) {
  return screen.getByRole("navigation", en["home.tabs.aria"]);
}

async function openClaudePane(app: Openable, screen: Screen): Promise<void> {
  await app.open("/");
  await expect(footer(screen).getByRole("button", new RegExp(`^${en["home.tabs.dashboard"]}(?:\\s*,|$)`, "u"))).toBeVisible();
  await screen.getByRole("button", /^claude logo claude/u).tap();
}

async function expectCheckoutRow(screen: Screen): Promise<void> {
  const row = screen.getByRole("button", /checkout\.tsx/u);
  await expect(row).toBeVisible();
  await expect(row).toHaveAccessibleName(new RegExp(en["changes.status.M"], "u"));
  await expect(row).toHaveAccessibleName(/\+3/u);
  await expect(row).toHaveAccessibleName(/−1/u);
}

async function showChangesList(screen: Screen): Promise<void> {
  const mode = screen.getByRole("radiogroup", en["files.mode.aria"]);
  const changes = mode.getByRole("radio", /^Changes\b/u);
  await expect(mode.getByRole("radio", en["files.mode.all"])).toHaveAttribute("aria-checked", "true");
  await changes.tap();
  await expect(changes).toHaveAttribute("aria-checked", "true");
  await expect(screen.getByRole("button", en["changes.layout.tree"])).toHaveAttribute("aria-pressed", "false");
}

test("CHG-LIST/pane/v2 — the Files belt opens Changes and shows checkout.tsx as Modified without writes", async ({ app, screen, browser, prepared }) => {
  expect(prepared).toBe(true);
  const writes = watchWrites();
  await openClaudePane(app, screen);
  await expect(browser).toHaveURL(PANE_URL);
  const entry = screen.getByRole("button", en["chat.changes.label"]);
  await expect(entry).toBeVisible();
  await entry.tap();
  await expect(screen.getByRole("heading", new RegExp(`^${en["files.title"]}\\b`, "u"))).toBeVisible();
  await showChangesList(screen);
  await expectCheckoutRow(screen);
  await expect(screen.getByRole("button", /^Stage\b/u)).toHaveCount(0);
  await expect(screen.getByRole("button", /^Commit\b/u)).toHaveCount(0);
  await expect(screen.getByRole("button", /Check out/u)).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("CHG-LIST/dashboard/v2 — footer Files opens webapp and its Changes segment shows the same fixture file", async ({ app, screen, browser, prepared }) => {
  expect(prepared).toBe(true);
  const writes = watchWrites();
  await app.open("/");
  await footer(screen).getByRole("button", en["files.title"]).tap();
  const list = screen.getByRole("list", en["home.changes.listAria"]);
  await expect(list).toBeVisible();
  const row = list.getByRole("button", new RegExp(`^${WEBAPP.label}\\b`, "u"));
  await expect(row).toBeVisible();
  await row.tap();
  await expect(browser).toHaveURL(new RegExp(`/space/${WEBAPP.workspaceId}/changes`, "u"));
  await showChangesList(screen);
  await expectCheckoutRow(screen);
  expect(writes).toEqual([]);
});

test("IDLE/visible — an open visible pane pauses at the real deadline and resume keeps the route and draft", async ({ app, screen, browser, prepared }) => {
  expect(prepared).toBe(true);
  // Install while the engine page is still the blank bootstrap, before the product document.
  await page().clock.install({ time: new Date(CLOCK_TIME) });
  await openClaudePane(app, screen);
  await expect(browser).toHaveURL(PANE_URL);
  const field = screen.getByRole("textbox", en["composer.placeholder.reply"]);
  await field.fill(DRAFT);
  await expect(field).toHaveValue(DRAFT);
  const visibility = await page().evaluate(() => document.visibilityState);
  expect(visibility).toBe("visible");
  await expect(screen.getByRole("dialog", en["idle.dialogAria"])).toHaveCount(0);
  await page().clock.fastForward(DEADLINE_MS);
  const cover = screen.getByRole("dialog", en["idle.dialogAria"]);
  await expect(cover).toBeVisible();
  await expect(cover.getByText(en["idle.paused.title"])).toBeVisible();
  await expect(cover.getByText(en["idle.paused.body"])).toBeVisible();
  await expect(browser).toHaveURL(PANE_URL);
  await cover.getByRole("button", en["idle.resume"]).tap();
  await expect(cover).toBeHidden();
  await expect(screen.getByRole("textbox", en["composer.placeholder.reply"])).toHaveValue(DRAFT);
  await expect(browser).toHaveURL(PANE_URL);
  console.log(`IDLE_VISIBILITY_PROBE ${JSON.stringify(await visibilityProbe())}`);
});

// One public CDP lifecycle call. "frozen" is the only non-active state in the
// installed 1.63 protocol; it is not a visibility API. The native value is logged
// and never forced through a document getter or a synthetic visibilitychange.
async function visibilityProbe(): Promise<{ before: string; after: string; error?: string }> {
  const before = await page().evaluate(() => document.visibilityState);
  try {
    const client = await page().context().newCDPSession(page());
    try {
      await client.send("Page.setWebLifecycleState", { state: "frozen" });
      const after = await page().evaluate(() => document.visibilityState);
      return { before, after };
    } finally {
      await client.send("Page.setWebLifecycleState", { state: "active" }).catch(() => undefined);
      await client.detach().catch(() => undefined);
    }
  } catch (error) {
    return { before, after: before, error: error instanceof Error ? error.message : String(error) };
  }
}
