import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "e2e";
import { surfaceOf } from "@e2e-dev/web";
import { z } from "zod";

import { en } from "../../src/lib/i18n/messages/en.ts";
import { fixtureSnapshot } from "../../src/test/handlers.ts";
import { namedHeaderConfig } from "../../src/test/fork-regression-data.ts";
import type { SnapshotResponse } from "../../src/lib/types.ts";
import { engine } from "./engine.ts";
import { test } from "./fixtures.ts";

interface ApiWrite {
  method: string;
  path: string;
  body: unknown;
}

interface Watch {
  writes: ApiWrite[];
  escapedOrigins: string[];
  claudeStatuses: string[];
}

const statusSnapshot = z.object({
  agents: z.array(z.object({ agent: z.string(), status: z.enum(["idle", "working", "blocked", "done", "unknown"]) })),
});

function watchApi(origin: string): Watch {
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  const watched: Watch = { writes: [], escapedOrigins: [], claudeStatuses: [] };
  const context = live.context();
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) watched.escapedOrigins.push(url.origin);
    if (url.pathname.startsWith("/api/") && request.method() !== "GET") {
      watched.writes.push({ method: request.method(), path: url.pathname, body: request.postDataJSON() });
    }
  });
  context.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname !== "/api/snapshot" || response.request().method() !== "GET") return;
    void response.json().then((body) => {
      const parsed = statusSnapshot.safeParse(body);
      const status = parsed.success ? parsed.data.agents.find((agent) => agent.agent === "claude")?.status : undefined;
      if (status !== undefined) watched.claudeStatuses.push(status);
      return null;
    }).catch(() => null);
  });
  return watched;
}

function mentionsCompact(write: ApiWrite): boolean {
  const direct = write.path.endsWith("/reply") || write.path.endsWith("/keys");
  const encoded = JSON.stringify(write.body);
  return direct && encoded !== undefined && encoded.includes("/compact");
}

function workingClaudeSnapshot(): SnapshotResponse {
  const next = structuredClone(fixtureSnapshot);
  const claude = next.agents[0];
  if (claude === undefined || claude.agent !== "claude" || claude.status !== "blocked") {
    throw new Error("fixtureSnapshot no longer leads with the blocked claude pane");
  }
  claude.status = "working";
  return next;
}

function earlier(text: string, first: string, second: string): boolean {
  const start = text.indexOf(first);
  return start >= 0 && text.indexOf(second) > start;
}

interface Evidence {
  origin: string;
  escapedOrigins: string[];
  writes?: ApiWrite[];
  claudeStatuses?: string[];
}

function writeEvidence(caseId: string, payload: Evidence): void {
  const output = resolve(import.meta.dirname, ".e2e", process.env.COLLIE_E2E_RUN_ID ?? "local");
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, `${caseId}.json`), JSON.stringify(payload, null, 2));
}

const summaryName = `1 ${en["status.label.blocked"]} 1 ${en["status.label.working"]} ${en["chat.switcher.title"]}`;
// Once the blocked claude pane is working too, the summary leads with the all-clear sentence.
const refreshedSummary = `${en["home.allClear"]} 2 ${en["status.label.working"]} ${en["chat.switcher.title"]}`;

test("title-dash/v3 — fork wordmark is visible with the published mux identity", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  await live.page().route("**/api/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(namedHeaderConfig) }));
  try {
    await app.open("/");
    await expect(screen.getByText("on reference", { exact: true })).toBeVisible();
    await expect(screen.getByText("GADDI")).toBeVisible();
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("title-dash-v3", { origin, escapedOrigins: watched.escapedOrigins });
  }
});

test("palette-danger-stage/v1 — /clear stages once and does not send", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await app.open("/pane/w1:p1");
    const field = screen.getByRole("textbox", en["composer.placeholder.reply"]);
    const palette = screen.getByRole("dialog", en["commands.title"]);
    await screen.getByRole("button", en["composer.controls.agent"], { exact: true }).tap();
    await expect(palette).toBeVisible();
    await palette.getByRole("button", /^\/clear\s/).tap();
    await expect(field).toHaveValue("/clear");
    await expect(palette).toBeHidden();
    expect(watched.writes).toEqual([]);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("palette-danger-stage-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("bar-compact-direct/v1 — Compact sends, it does not stage", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await app.open("/pane/w1:p1");
    const field = screen.getByRole("textbox", en["composer.placeholder.reply"]);
    await expect(field).toBeVisible();
    expect(watched.writes).toEqual([]);
    await screen.getByRole("group", en["harnessBar.label"]).getByRole("button", en["harnessBar.compact"], { exact: true }).tap();
    await expect.poll(() => watched.writes.some(mentionsCompact)).toBe(true);
    await expect(field).toHaveValue("");
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("bar-compact-direct-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("switcher-dashboard-attention/v1 — Needs you claude before Working codex", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await app.open("/");
    await screen.getByRole("button", summaryName, { exact: true }).tap();
    const dialog = screen.getByRole("dialog", en["chat.switcher.title"]);
    const headings = (await dialog.getByRole("heading").allTextContents()).join("\n").toLowerCase();
    const rows = await dialog.getByRole("button").allTextContents();
    expect(earlier(headings, "needs you", "working")).toBe(true);
    expect(headings.includes("webapp")).toBe(false);
    expect(earlier(rows.join("\n"), "claude", "codex")).toBe(true);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("switcher-dashboard-attention-v1", { origin, escapedOrigins: watched.escapedOrigins });
  }
});

test("switcher-pane-attention/v1 — Layers uses attention, not workspace groups", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await app.open("/pane/w1:p1");
    await screen.getByRole("button", en["chat.switcher.aria"], { exact: true }).tap();
    const dialog = screen.getByRole("dialog", en["chat.switcher.title"]);
    const headings = (await dialog.getByRole("heading").allTextContents()).join("\n").toLowerCase();
    const rows = await dialog.getByRole("button").allTextContents();
    expect(earlier(headings, "needs you", "working")).toBe(true);
    expect(headings.includes("webapp")).toBe(false);
    expect(headings.includes("collie")).toBe(false);
    expect(earlier(rows.join("\n"), "claude", "codex")).toBe(true);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("switcher-pane-attention-v1", { origin, escapedOrigins: watched.escapedOrigins });
  }
});

test("switcher-freeze-refresh/v1 — open list stays, the next open reads the new status", async ({ app, screen, browser }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  try {
    await app.open("/");
    await screen.getByRole("button", summaryName, { exact: true }).tap();
    const dialog = screen.getByRole("dialog", en["chat.switcher.title"]);
    await expect(dialog.getByRole("heading", /^needs you/i)).toBeVisible();
    // Reload would close the sheet (home's closeSwitcher). The next snapshot is a route swap plus the existing visibility poll.
    const updated = workingClaudeSnapshot();
    await live.page().route("**/api/snapshot*", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(updated),
    }));
    await browser.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      return true;
    });
    await expect.poll(() => watched.claudeStatuses.includes("working")).toBe(true);
    await expect(dialog.getByRole("heading", /^needs you/i)).not.toHaveCount(0);
    expect(earlier((await dialog.getByRole("button").allTextContents()).join("\n"), "claude", "codex")).toBe(true);

    await dialog.getByRole("button", en["common.closeAria"], { exact: true }).tap();
    await expect(dialog).toBeHidden();
    await screen.getByRole("button", refreshedSummary, { exact: true }).tap();
    const reopened = screen.getByRole("dialog", en["chat.switcher.title"]);
    await expect(reopened.getByRole("heading", /^needs you/i)).toHaveCount(0);
    await expect(reopened.getByRole("heading", /^working/i)).toBeVisible();
    const rows = (await reopened.getByRole("button").allTextContents()).join("\n");
    expect(earlier(rows, "claude", "codex")).toBe(true);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("switcher-freeze-refresh-v1", {
      origin,
      claudeStatuses: watched.claudeStatuses,
      escapedOrigins: watched.escapedOrigins,
    });
  }
});

test("dashboard-stays-place/v1 — dashboard body stays grouped by workspace", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await app.open("/");
    const places = await screen.getByRole("heading", /^(webapp|collie)$/, { level: 2 }).allTextContents();
    expect(places).toEqual(["webapp", "collie"]);
    await expect(screen.getByRole("heading", { name: /^(needs you|ready|working|recent)/i })).toHaveCount(0);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("dashboard-stays-place-v1", { origin, escapedOrigins: watched.escapedOrigins });
  }
});

test("switcher-shells-trailing/v1 — Shells follow the attention sections", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await app.open("/pane/w1:p1");
    await screen.getByRole("button", en["chat.switcher.aria"], { exact: true }).tap();
    const dialog = screen.getByRole("dialog", en["chat.switcher.title"]);
    const headings = (await dialog.getByRole("heading").allTextContents()).join("\n").toLowerCase();
    const rows = (await dialog.getByRole("button").allTextContents()).join("\n");
    expect(earlier(headings, "working", "shells")).toBe(true);
    expect(earlier(rows, "codex", "shell")).toBe(true);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("switcher-shells-trailing-v1", { origin, escapedOrigins: watched.escapedOrigins });
  }
});

test("retell-absent/v1 — default world has no Plain or Lost rows", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await app.open("/pane/w1:p1");
    await screen.getByRole("button", en["chat.paneMenu.aria"], { exact: true }).tap();
    const sheet = screen.getByRole("dialog", "claude");
    await expect(sheet.getByRole("button", en["paneActions.pin.label"], { exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", en["retell.plain"], { exact: true })).toHaveCount(0);
    await expect(sheet.getByRole("button", en["retell.lost"], { exact: true })).toHaveCount(0);
    expect(watched.writes).toEqual([]);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("retell-absent-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});
