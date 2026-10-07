import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Screen } from "e2e";
import { surfaceOf } from "@e2e-dev/web";

import { en } from "../../src/lib/i18n/messages/en.ts";
import { fixtureAgents, fixtureSnapshot } from "../../src/test/handlers.ts";
import {
  accountChoice,
  accountHasSession,
  accountIdleLabels,
  accountIdleStatus,
  accountWorkingLabels,
  accountWorkingStatus,
  accountsConfig,
  changedPermissionScreen,
  fullReply,
  fullReplyAfter,
  fullReplyHasSession,
  fullReplyHead,
  fullReplyHistory,
  fullReplyIdentityScreen,
  fullReplyPrompt,
  fullReplyReadableLines,
  fullReplyScreen,
  fullReplyTail,
  permissionCommand,
  permissionNo,
  permissionYes,
  switchAccepted,
  unknownModalScreen,
} from "../../src/test/fork-supplement-data.ts";
import type { AgentView, SnapshotResponse } from "../../src/lib/types.ts";
import { fill } from "../fixtures/api.ts";
import { engine } from "./engine.ts";
import { pinTerminalView, test } from "./fixtures.ts";

interface ApiWrite {
  method: string;
  path: string;
  body: unknown;
}

interface Watch {
  writes: ApiWrite[];
  escapedOrigins: string[];
}

const panesDir = resolve(import.meta.dirname, "../../src/fixtures/panes");
const permissionCapture = readFileSync(resolve(panesDir, "claude--permission-bash.txt"), "utf8");
const questionCapture = readFileSync(resolve(panesDir, "claude--select-menu.txt"), "utf8");

function page() {
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  return live.page();
}

function watchApi(origin: string): Watch {
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  const watched: Watch = { writes: [], escapedOrigins: [] };
  live.context().on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) watched.escapedOrigins.push(url.origin);
    if (url.pathname.startsWith("/api/") && request.method() !== "GET") {
      watched.writes.push({ method: request.method(), path: url.pathname, body: request.postDataJSON() });
    }
  });
  return watched;
}

interface Evidence {
  origin: string;
  writes: ApiWrite[];
  escapedOrigins: string[];
}

function writeEvidence(caseId: string, payload: Evidence): void {
  const output = resolve(import.meta.dirname, ".e2e", process.env.COLLIE_E2E_RUN_ID ?? "local");
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, `${caseId}.json`), JSON.stringify(payload, null, 2));
}

function withClaude(patch: Partial<AgentView>): SnapshotResponse {
  const next = structuredClone(fixtureSnapshot);
  const claude = next.agents[0];
  if (claude === undefined || claude.paneId !== "w1:p1" || claude.agent !== fixtureAgents[0]?.agent) {
    throw new Error("fixtureAgents[0] is no longer the claude pane w1:p1");
  }
  Object.assign(claude, patch);
  return next;
}

function decodedPath(write: ApiWrite): ApiWrite {
  return { ...write, path: decodeURIComponent(write.path) };
}

function postsTo(watched: Watch, suffix: string): ApiWrite[] {
  return watched.writes.filter((write) => write.method === "POST" && decodeURIComponent(write.path).endsWith(suffix));
}

type FixtureBody = SnapshotResponse | ReturnType<typeof accountsConfig> | typeof switchAccepted | ReturnType<typeof fullReplyHistory>;

async function serveJson(matcher: (url: URL) => boolean, body: FixtureBody): Promise<void> {
  await page().route(matcher, (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(body),
  }));
}

async function serveSnapshot(snapshot: SnapshotResponse): Promise<void> {
  await serveJson((url) => url.pathname === "/api/snapshot", snapshot);
}

// list-approval.test.tsx answers the pane read as { paneId, text, revision: 0, truncated: false }.
async function servePaneText(initial: string): Promise<{ setText: (next: string) => void }> {
  let text = initial;
  await page().route((url) => /^\/api\/pane\/[^/]+$/.test(url.pathname), (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ paneId: "w1:p1", text, revision: 0, truncated: false }),
  }));
  return { setText(next: string): void { text = next; } };
}

async function serveHistory(body: ReturnType<typeof fullReplyHistory>): Promise<void> {
  await serveJson((url) => /^\/api\/pane\/[^/]+\/history$/.test(url.pathname), body);
}

const sentCopy = fill(en["paneActions.account.done"], { account: accountChoice });
const confirmCopy = fill(en["paneActions.account.confirmInterrupt"], { account: accountChoice });
// The title span is CSS-uppercased, so the accessible name may not keep the dictionary's case.
const fullReplyButton = new RegExp(en["chat.fullReply.title"], "i");

test("account-idle-sent/v1 — an idle Personal switch posts once and says it was sent", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  const snapshot = withClaude({ status: accountIdleStatus, hasSession: accountHasSession });
  const dialogName = snapshot.agents[0]?.agent;
  if (dialogName === undefined) throw new Error("claude agent name missing");
  try {
    await serveSnapshot(snapshot);
    await serveJson((url) => url.pathname === "/api/config", accountsConfig(accountIdleLabels));
    await serveJson((url) => url.pathname.endsWith("/switch-account"), switchAccepted);
    await app.open("/pane/w1:p1");
    await screen.getByRole("button", en["chat.paneMenu.aria"], { exact: true }).tap();
    const dialog = screen.getByRole("dialog", dialogName);
    await dialog.getByRole("button", en["paneActions.account.label"], { exact: true }).tap();
    await dialog.getByRole("button", accountChoice, { exact: true }).tap();
    await expect.poll(() => postsTo(watched, "/switch-account").map(decodedPath)).toEqual([
      { method: "POST", path: "/api/pane/w1:p1/switch-account", body: { account: accountChoice, interrupt: false } },
    ]);
    await expect(screen.getByText(sentCopy, { exact: true })).toBeVisible();
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("account-idle-sent-v1");
  } finally {
    writeEvidence("account-idle-sent-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("account-working-confirm/v1 — the first tap arms, the second is the only interrupt post", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  const snapshot = withClaude({ status: accountWorkingStatus, hasSession: accountHasSession });
  const dialogName = snapshot.agents[0]?.agent;
  if (dialogName === undefined) throw new Error("claude agent name missing");
  try {
    await serveSnapshot(snapshot);
    await serveJson((url) => url.pathname === "/api/config", accountsConfig(accountWorkingLabels));
    await serveJson((url) => url.pathname.endsWith("/switch-account"), switchAccepted);
    await app.open("/pane/w1:p1");
    await screen.getByRole("button", en["chat.paneMenu.aria"], { exact: true }).tap();
    const dialog = screen.getByRole("dialog", dialogName);
    await dialog.getByRole("button", en["paneActions.account.label"], { exact: true }).tap();
    await dialog.getByRole("button", accountChoice, { exact: true }).tap();
    const confirm = dialog.getByRole("button", confirmCopy, { exact: true });
    await expect(confirm).toBeVisible();
    expect(postsTo(watched, "/switch-account")).toEqual([]);
    await confirm.tap();
    await expect.poll(() => postsTo(watched, "/switch-account").map(decodedPath)).toEqual([
      { method: "POST", path: "/api/pane/w1:p1/switch-account", body: { account: accountChoice, interrupt: true } },
    ]);
    await expect(screen.getByText(sentCopy, { exact: true })).toBeVisible();
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("account-working-confirm-v1");
  } finally {
    writeEvidence("account-working-confirm-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

async function tapBlocked(screen: Screen): Promise<void> {
  const agent = fixtureAgents[0]?.agent;
  if (agent === undefined) throw new Error("fixtureAgents[0] is missing");
  await screen.getByRole("button", new RegExp(agent)).tap();
}

test("list-permission-sheet/v1 — a blocked row reads the capture and writes nothing", async ({ app, screen, browser }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await servePaneText(permissionCapture);
    await app.open("/");
    await tapBlocked(screen);
    const dialog = screen.getByRole("dialog", en["prompt.family.permission"]);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(permissionCommand, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", permissionYes, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", permissionNo, { exact: true })).toBeVisible();
    await expect(browser).toHaveURL("/");
    expect(postsTo(watched, "/keys")).toEqual([]);
    expect(watched.writes).toEqual([]);
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("list-permission-sheet-v1");
  } finally {
    writeEvidence("list-permission-sheet-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("list-choice-one-post/v1 — one printed choice posts keys once and stays on the dashboard", async ({ app, screen, browser }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await servePaneText(permissionCapture);
    await app.open("/");
    await tapBlocked(screen);
    const dialog = screen.getByRole("dialog", en["prompt.family.permission"]);
    await dialog.getByRole("button", permissionYes, { exact: true }).tap();
    // The unit's key digit is not an expectation; the contract only requires one keys POST.
    await expect.poll(() => postsTo(watched, "/keys").map((write) => decodedPath(write).path)).toEqual([
      "/api/pane/w1:p1/keys",
    ]);
    await expect(dialog).toBeHidden();
    await expect(browser).toHaveURL("/");
    expect(postsTo(watched, "/keys")).toHaveLength(1);
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("list-choice-one-post-v1");
  } finally {
    writeEvidence("list-choice-one-post-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("list-prompt-changed/v1 — a replaced command closes the sheet with no keys post", async ({ app, screen, browser }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    const pane = await servePaneText(permissionCapture);
    await app.open("/");
    await tapBlocked(screen);
    const dialog = screen.getByRole("dialog", en["prompt.family.permission"]);
    await expect(dialog.getByText(permissionCommand, { exact: true })).toBeVisible();
    pane.setText(changedPermissionScreen(permissionCapture));
    // visibilitychange would also POST /api/refresh, and the sheet closes itself when document.hidden.
    // focus only runs the existing poll tick, which revalidates while the page stays visible.
    await browser.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      return true;
    });
    await expect(dialog).toBeHidden();
    expect(postsTo(watched, "/keys")).toEqual([]);
    expect(watched.writes).toEqual([]);
    await expect(browser).toHaveURL("/");
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("list-prompt-changed-v1");
  } finally {
    writeEvidence("list-prompt-changed-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("list-question-opens-pane/v1 — the select-menu capture opens the pane and posts nothing", async ({ app, screen, browser }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await servePaneText(questionCapture);
    await app.open("/");
    await tapBlocked(screen);
    await expect(browser).toHaveURL(/\/pane\/w1(?:%3A|:)p1$/);
    await expect(screen.getByRole("dialog", en["prompt.family.permission"])).toHaveCount(0);
    expect(postsTo(watched, "/keys")).toEqual([]);
    expect(watched.writes).toEqual([]);
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("list-question-opens-pane-v1");
  } finally {
    writeEvidence("list-question-opens-pane-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("list-unknown-opens-pane/v1 — the unit's unknown modal opens the pane and posts nothing", async ({ app, screen, browser }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await servePaneText(unknownModalScreen);
    await app.open("/");
    await tapBlocked(screen);
    await expect(browser).toHaveURL(/\/pane\/w1(?:%3A|:)p1$/);
    await expect(screen.getByRole("dialog", en["prompt.family.permission"])).toHaveCount(0);
    expect(postsTo(watched, "/keys")).toEqual([]);
    expect(watched.writes).toEqual([]);
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("list-unknown-opens-pane-v1");
  } finally {
    writeEvidence("list-unknown-opens-pane-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

async function openFullReply(text: string, prompt?: string): Promise<void> {
  await pinTerminalView();
  await serveSnapshot(withClaude({ hasSession: fullReplyHasSession, readableLines: fullReplyReadableLines }));
  await servePaneText(text);
  await serveHistory(fullReplyHistory(fullReply, prompt));
}

test("full-reply-paired/v2 — the card shows the prompt and does not repeat the covered tail", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await openFullReply(fullReplyScreen(), fullReplyPrompt);
    await app.open("/pane/w1:p1");
    await expect(screen.getByRole("button", fullReplyButton)).toBeVisible();
    await expect(screen.getByText(fullReplyPrompt, { exact: true })).toBeVisible();
    await expect(screen.getByText(fullReplyHead, { exact: false })).toBeVisible();
    await expect(screen.getByText(fullReplyTail, { exact: false })).toHaveCount(1);
    await expect(screen.getByText(fullReplyAfter, { exact: false })).toBeVisible();
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("full-reply-paired-v2");
  } finally {
    writeEvidence("full-reply-paired-v2", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("full-reply-no-prompt/v2 — history with no user turn leaves the tail and draws no card", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await openFullReply(fullReplyScreen());
    await app.open("/pane/w1:p1");
    await expect(screen.getByText(fullReplyTail, { exact: false })).toBeVisible();
    await expect(screen.getByText(fullReplyAfter, { exact: false })).toBeVisible();
    await expect(screen.getByRole("button", fullReplyButton)).toHaveCount(0);
    await expect(screen.getByText(fullReplyHead, { exact: false })).toHaveCount(0);
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("full-reply-no-prompt-v2");
  } finally {
    writeEvidence("full-reply-no-prompt-v2", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("full-reply-identity-miss/v2 — a different screen draws no Full reply card", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await openFullReply(fullReplyIdentityScreen, fullReplyPrompt);
    await app.open("/pane/w1:p1");
    await expect(screen.getByText(fullReplyIdentityScreen, { exact: false })).toBeVisible();
    await expect(screen.getByRole("button", fullReplyButton)).toHaveCount(0);
    expect(watched.escapedOrigins).toEqual([]);
    await app.screenshot("full-reply-identity-miss-v2");
  } finally {
    writeEvidence("full-reply-identity-miss-v2", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});
