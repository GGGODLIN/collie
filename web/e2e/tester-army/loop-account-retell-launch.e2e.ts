import { surfaceOf } from "@e2e-dev/web";
import { expect } from "e2e";
import type { Screen } from "e2e";

import { apiError } from "../../../bridge/error-codes.ts";
import { en } from "../../src/lib/i18n/messages/en.ts";
import type { CreateResponse, LaunchersResponse, RetellResponse, SnapshotResponse } from "../../src/lib/types.ts";
import { accountChoice, accountHasSession, accountIdleLabels, accountIdleStatus, accountsConfig } from "../../src/test/fork-supplement-data.ts";
import { fixtureSnapshot } from "../../src/test/handlers.ts";
import {
  launchHere,
  launchHome,
  launchPeek,
  launchQuota,
  launchReadOnly,
  launchSuccess,
  retellFailedReason,
  retellLostDone,
  retellPlainFailed,
} from "../../src/test/sweep-loop-actions-data.ts";
import { fill } from "../fixtures/api.ts";
import { engine } from "./engine.ts";
import { test } from "./fixtures.ts";

// Loop batch 03. Account refusal is the bridge's HTTP 409 account.draft_present
// body, shown with messages/en.ts; it does not prove the terminal draft was kept.
// Retell serves the original finished and failed literals and only checks the
// sheet plus the request mode. Launch checks the original three rows and the
// one dashboard command-key POST, or the read-only short-circuit. No case opens
// a real pane, runs a sidecar, or proves the server allowlist.

const DASHBOARD = "/";
const LAUNCH_HEADING = /^launch\b/iu;
// The fixture herd's accessible name, the same row loop-appearance-zen already opens.
const CLAUDE_ROW = /^claude logo claude/u;
const SWITCH_PANE = new RegExp(`^${en["chat.switcher.aria"]}\\b`, "u");

const launchersOn: LaunchersResponse = {
  launchers: [launchPeek, launchQuota, launchHere],
  home: launchHome,
};

interface Openable {
  open: (path?: string) => Promise<void>;
}

interface ApiPost {
  path: string;
  body: string | null;
}

function page() {
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  return live.page();
}

function claudePaneId(): string {
  const found = fixtureSnapshot.agents.find((agent) => agent.agent === "claude");
  if (found === undefined) throw new Error("fixture snapshot has no Claude pane");
  return found.paneId;
}

function idleClaudeSnapshot(): SnapshotResponse {
  const paneId = claudePaneId();
  return {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent) =>
      agent.paneId === paneId
        ? { ...agent, status: accountIdleStatus, hasSession: accountHasSession }
        : agent,
    ),
  };
}

// The catalogue sentence is what the bridge puts on the wire. The screen expectation
// is the dictionary entry, not this object's `error` field.
function accountDraftWire() {
  const fragment = apiError("account.draft_present");
  return { ok: false as const, error: fragment.error, code: fragment.code };
}

function watchApiPosts(): ApiPost[] {
  const posts: ApiPost[] = [];
  page().on("request", (request) => {
    if (request.method() !== "POST") return;
    const path = decodeURIComponent(new URL(request.url()).pathname);
    if (!path.startsWith("/api/")) return;
    posts.push({ path, body: request.postData() });
  });
  return posts;
}

function requestPath(url: URL): string {
  return decodeURIComponent(url.pathname);
}

async function fulfillPath<Body>(pathname: string, body: Body, status = 200): Promise<void> {
  await page().route(
    (url) => requestPath(url) === pathname,
    (route) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      }),
  );
}

async function openDashboard(app: Openable, screen: Screen): Promise<void> {
  await app.open(DASHBOARD);
  await expect(screen.getByRole("navigation", en["home.tabs.aria"]).getByRole("button", en["home.tabs.panes"])).toBeVisible();
}

async function openClaudeSheet(app: Openable, screen: Screen): Promise<void> {
  await openDashboard(app, screen);
  await expect(screen.getByRole("button", CLAUDE_ROW)).toBeVisible();
  await screen.getByRole("button", CLAUDE_ROW).tap();
  await screen.getByRole("button", en["chat.paneMenu.aria"]).tap();
  await expect(screen.getByRole("dialog").getByRole("button", en["chat.find.label"])).toBeVisible();
}

function posted(posts: readonly ApiPost[], suffix: string): ApiPost[] {
  return posts.filter((post) => post.path.endsWith(suffix));
}

test("ACCT-DRAFT/refuse — Personal shows the unsent-text refusal, records one account POST, and does not resend", async ({ app, screen, browser }) => {
  const posts = watchApiPosts();
  const wire = accountDraftWire();
  const paneId = claudePaneId();
  await fulfillPath("/api/snapshot", idleClaudeSnapshot());
  await fulfillPath("/api/config", { ...accountsConfig(accountIdleLabels), retell: true });
  await fulfillPath(`/api/pane/${paneId}/switch-account`, wire, 409);
  await openClaudeSheet(app, screen);
  const sheet = screen.getByRole("dialog");
  await expect(sheet.getByRole("button", en["paneActions.account.label"])).toBeVisible();
  await sheet.getByRole("button", en["paneActions.account.label"]).tap();
  await expect(sheet.getByRole("button", accountChoice)).toBeVisible();

  const pending = browser.waitForResponse(/\/switch-account(?:\?|$)/u);
  await sheet.getByRole("button", accountChoice).tap();
  const response = await pending;
  expect(response.status).toBe(409);
  expect(await response.json<{ ok: false; error: string; code: string }>()).toEqual(wire);
  await expect(screen.getByText(en["apiError.account.draft_present"])).toBeVisible();
  await expect(screen.getByText(fill(en["paneActions.account.done"], { account: accountChoice }))).toHaveCount(0);
  await expect(sheet.getByRole("button", accountChoice)).toBeVisible();
  expect(posted(posts, "/switch-account")).toEqual([
    {
      path: `/api/pane/${paneId}/switch-account`,
      body: JSON.stringify({ account: accountChoice, interrupt: false }),
    },
  ]);
  expect(posted(posts, "/keys")).toEqual([]);
  expect(posted(posts, "/reply")).toEqual([]);
});

test("RETELL-ON/lost — Plain and Lost are offered, and Lost shows the original finished answer", async ({ app, screen, browser }) => {
  const posts = watchApiPosts();
  const paneId = claudePaneId();
  await fulfillPath("/api/snapshot", idleClaudeSnapshot());
  await fulfillPath("/api/config", { ...accountsConfig(accountIdleLabels), retell: true });
  await fulfillRetell(paneId);
  await openClaudeSheet(app, screen);
  const sheet = screen.getByRole("dialog");
  await expect(sheet.getByRole("button", en["retell.plain"])).toBeVisible();
  await expect(sheet.getByRole("button", en["retell.lost"])).toBeVisible();

  const pending = browser.waitForResponse(/\/retell(?:\?|$)/u);
  await sheet.getByRole("button", en["retell.lost"]).tap();
  const response = await pending;
  expect(response.status).toBe(200);
  expect(await response.json<RetellResponse>()).toEqual(retellLostDone);
  await expect(screen.getByRole("dialog", en["retell.lost"])).toBeVisible();
  await expect(screen.getByText(retellLostDone.answer)).toBeVisible();
  await expect(screen.getByText(en["retell.cached"])).toBeVisible();
  expect(posted(posts, "/retell")).toEqual([
    { path: `/api/pane/${paneId}/retell`, body: JSON.stringify({ mode: "lost", fresh: false }) },
  ]);
});

test("RETELL-ON/plain-broken — Plain shows the original sidecar reason", async ({ app, screen, browser }) => {
  const posts = watchApiPosts();
  const paneId = claudePaneId();
  await fulfillPath("/api/snapshot", idleClaudeSnapshot());
  await fulfillPath("/api/config", { ...accountsConfig(accountIdleLabels), retell: true });
  await fulfillRetell(paneId);
  await openClaudeSheet(app, screen);
  const sheet = screen.getByRole("dialog");
  await expect(sheet.getByRole("button", en["retell.plain"])).toBeVisible();
  await expect(sheet.getByRole("button", en["retell.lost"])).toBeVisible();

  const pending = browser.waitForResponse(/\/retell(?:\?|$)/u);
  await sheet.getByRole("button", en["retell.plain"]).tap();
  const response = await pending;
  expect(response.status).toBe(200);
  expect(await response.json<RetellResponse>()).toEqual(retellPlainFailed);
  await expect(screen.getByRole("dialog", en["retell.plain"])).toBeVisible();
  await expect(screen.getByRole("dialog", en["retell.plain"]).getByText(retellFailedReason, { exact: true })).toBeVisible();
  expect(posted(posts, "/retell")).toEqual([
    { path: `/api/pane/${paneId}/retell`, body: JSON.stringify({ mode: "plain", fresh: false }) },
  ]);
});

test("LAUNCH-ON/dashboard — the three rows are on the herd, and one tap posts only that command key", async ({ app, screen, browser }) => {
  const posts = watchApiPosts();
  await fulfillPath("/api/launchers", launchersOn);
  await fulfillPath("/api/launch", launchSuccess);
  await openDashboard(app, screen);
  await expect(screen.getByRole("heading", LAUNCH_HEADING)).toBeVisible();
  await expect(screen.getByRole("button", /Runs & quota/u)).toHaveText("Runs & quota ~/project rumen-peek");
  await expect(screen.getByRole("button", /Quota bars/u)).toHaveText("Quota bars ~/project showy-quota-peek");
  await expect(screen.getByRole("button", /^Top\b/u)).toHaveText("Top htop");

  const pending = browser.waitForResponse(/\/api\/launch(?:\?|$)/u);
  await screen.getByRole("button", /Runs & quota/u).tap();
  const response = await pending;
  expect(response.status).toBe(200);
  expect(await response.json<Extract<CreateResponse, { ok: true }>>()).toEqual(launchSuccess);
  expect(posted(posts, "/launch")).toEqual([
    { path: "/api/launch", body: JSON.stringify({ command: launchPeek.command }) },
  ]);
});

test("LAUNCH-ON/switcher — the same three rows are in the pane sheet, and the cwd-less row says here", async ({ app, screen }) => {
  await fulfillPath("/api/launchers", launchersOn);
  await openDashboard(app, screen);
  await screen.getByRole("button", CLAUDE_ROW).tap();
  await screen.getByRole("button", SWITCH_PANE).tap();
  const sheet = screen.getByRole("dialog");
  await expect(sheet.getByRole("heading", LAUNCH_HEADING)).toBeVisible();
  await expect(sheet.getByRole("button", /Runs & quota/u)).toHaveText("Runs & quota ~/project rumen-peek");
  await expect(sheet.getByRole("button", /Quota bars/u)).toHaveText("Quota bars ~/project showy-quota-peek");
  await expect(sheet.getByRole("button", /^Top\b/u)).toHaveText(`Top ${en["chat.switcher.launch.here"]} htop`);
});

test("LAUNCH-ON/readonly — the rows stay, and a tap does not post /api/launch", async ({ app, screen }) => {
  const posts = watchApiPosts();
  await fulfillPath("/api/snapshot", { ...fixtureSnapshot, device: launchReadOnly });
  await fulfillPath("/api/launchers", launchersOn);
  await fulfillPath("/api/launch", launchSuccess);
  await openDashboard(app, screen);
  await expect(screen.getByRole("button", /Runs & quota/u)).toBeVisible();
  await expect(screen.getByRole("button", /Quota bars/u)).toBeVisible();
  await expect(screen.getByRole("button", /^Top\b/u)).toBeVisible();

  await screen.getByRole("button", /Runs & quota/u).tap();
  // The refusal can occupy multiple live regions; the contract is its text and no launch POST.
  expect(await screen.getByRole("status").allTextContents()).toContain(en["space.readOnly.deviceUnauthorised"]);
  expect(posted(posts, "/launch")).toEqual([]);
});

async function fulfillRetell(paneId: string): Promise<void> {
  await page().route(
    (url) => requestPath(url) === `/api/pane/${paneId}/retell`,
    (route) => {
      const raw = route.request().postData() ?? "";
      const body = raw.includes('"mode":"lost"') ? retellLostDone : retellPlainFailed;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    },
  );
}
