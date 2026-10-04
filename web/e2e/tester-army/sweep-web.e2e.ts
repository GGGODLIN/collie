import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "e2e";
import { surfaceOf } from "@e2e-dev/web";

import { en } from "../../src/lib/i18n/messages/en.ts";
import { fixtureSnapshot } from "../../src/test/handlers.ts";
import {
  ompForkIn,
  operatorBarStatus,
  operatorBarWipe,
  tiedRecentAgents,
  untimedBridgeAgents,
} from "../../src/test/sweep-data.ts";
import type { AgentView, OperatorCommand, SnapshotResponse } from "../../src/lib/types.ts";
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
}

function page() {
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  return live.page();
}

function watchApi(origin: string): Watch {
  const watched: Watch = { writes: [], escapedOrigins: [] };
  page().context().on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) watched.escapedOrigins.push(url.origin);
    if (url.pathname.startsWith("/api/") && request.method() !== "GET") {
      watched.writes.push({ method: request.method(), path: url.pathname, body: request.postDataJSON() });
    }
  });
  return watched;
}

function mentionsCommand(write: ApiWrite, command: string): boolean {
  const direct = write.path.endsWith("/reply") || write.path.endsWith("/keys");
  return direct && JSON.stringify(write.body).includes(JSON.stringify(command));
}

interface SweepEvidence {
  origin: string;
  escapedOrigins: string[];
  writes?: ApiWrite[];
  brandWidth?: number;
  identityHidden?: string | null;
}

function writeEvidence(caseId: string, payload: SweepEvidence): void {
  const output = resolve(import.meta.dirname, ".e2e", process.env.COLLIE_E2E_RUN_ID ?? "local");
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, `${caseId}.json`), JSON.stringify(payload, null, 2));
}

async function serveSnapshot(snapshot: SnapshotResponse): Promise<void> {
  await page().route("**/api/snapshot*", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(snapshot),
  }));
}

async function serveCommands(rows: readonly OperatorCommand[]): Promise<void> {
  await page().route("**/api/config", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ push: false, vapidPublicKey: "", operatorCommands: rows }),
  }));
}

function cloneSnapshot(agents: AgentView[]): SnapshotResponse {
  const snapshot = structuredClone(fixtureSnapshot);
  snapshot.agents = structuredClone(agents);
  return snapshot;
}

function rowIds(ids: readonly (string | null)[]): string[] {
  return ids.filter((id): id is string => id !== null);
}

test("title-no-mux/v1 — default config keeps the brand readable and home operable", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  let brandWidth = -1;
  let identityHidden: string | null = null;
  try {
    await app.open("/");
    const brand = screen.getByText("COLLIE-GGGODLIN", { exact: true });
    await expect(brand).toHaveCount(1);
    const box = await brand.boundingBox();
    brandWidth = box?.width ?? 0;
    identityHidden = await page().getByText("COLLIE-GGGODLIN", { exact: true }).evaluate((node) => node.parentElement?.getAttribute("hidden") ?? null);
    await expect(brand).toBeVisible();
    await expect(screen.getByText(/^on /)).toHaveCount(0);
    const home = screen.getByRole("button", en["nav.home.aria.default"], { exact: true });
    await expect(home).toBeVisible();
    await expect(home).toBeEnabled();
    await home.tap();
    await expect(screen.getByRole("button", /1 blocked/)).toBeVisible();
    expect(watched.writes).toEqual([]);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("title-no-mux-v1", { origin, brandWidth, identityHidden, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("operator-omp-replace/v1 — a non-Claude row replaces the palette and does not send", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  const snapshot = structuredClone(fixtureSnapshot);
  const pane = snapshot.agents[0];
  if (pane === undefined || pane.agent !== "claude" || pane.paneId !== "w1:p1") {
    throw new Error("fixtureSnapshot no longer leads with the claude pane w1:p1");
  }
  pane.agent = ompForkIn.agent ?? "";
  try {
    await serveSnapshot(snapshot);
    await serveCommands([ompForkIn]);
    await app.open("/pane/w1:p1");
    const bar = screen.getByRole("group", en["harnessBar.label"]);
    await expect(bar.getByRole("button", en["harnessBar.model"], { exact: true })).toBeVisible();
    await expect(bar.getByRole("button", en["harnessBar.tree"], { exact: true })).toBeVisible();
    await screen.getByRole("button", en["composer.controls.agent"], { exact: true }).tap();
    const palette = screen.getByRole("dialog", en["commands.title"]);
    await expect(palette).toBeVisible();
    const commands = await palette.getByRole("button", /^\//).allTextContents();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toContain("/fork-in-herdr");
    await expect(palette.getByRole("button", /^\/compact\s/)).toHaveCount(0);
    await palette.getByRole("button", /^\/fork-in-herdr\s/).tap();
    await expect(screen.getByRole("textbox", en["composer.placeholder.reply"])).toHaveValue("/fork-in-herdr");
    await expect(palette).toBeHidden();
    expect(watched.writes).toEqual([]);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("operator-omp-replace-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("operator-bar-independent/v1 — one bar row replaces the bar, and the palette still only stages", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await serveCommands([operatorBarStatus]);
    await app.open("/pane/w1:p1");
    const field = screen.getByRole("textbox", en["composer.placeholder.reply"]);
    const bar = screen.getByRole("group", en["harnessBar.label"]);
    await expect(bar.getByRole("button", "Status", { exact: true })).toBeVisible();
    await expect(bar.getByRole("button", en["harnessBar.model"], { exact: true })).toHaveCount(0);
    await expect(bar.getByRole("button", en["harnessBar.compact"], { exact: true })).toHaveCount(0);
    expect(watched.writes).toEqual([]);
    await bar.getByRole("button", "Status", { exact: true }).tap();
    await expect.poll(() => watched.writes.some((write) => mentionsCommand(write, "/statusline"))).toBe(true);
    await expect(field).toHaveValue("");
    const sent = watched.writes.length;
    await screen.getByRole("button", en["composer.controls.agent"], { exact: true }).tap();
    const palette = screen.getByRole("dialog", en["commands.title"]);
    await expect(palette.getByRole("button", /^\/compact\s/)).toBeVisible();
    await expect(palette.getByRole("button", /^\/statusline\s/)).toBeVisible();
    await palette.getByRole("button", /^\/statusline\s/).tap();
    await expect(field).toHaveValue("/statusline");
    await expect(palette).toBeHidden();
    expect(watched.writes).toHaveLength(sent);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("operator-bar-independent-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("operator-bar-wipe/v1 — a dangerous operator bar sends on the second tap only", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await serveCommands([operatorBarWipe]);
    await app.open("/pane/w1:p1");
    const field = screen.getByRole("textbox", en["composer.placeholder.reply"]);
    const bar = screen.getByRole("group", en["harnessBar.label"]);
    const wipe = bar.getByRole("button", "Wipe", { exact: true });
    await expect(wipe).toBeVisible();
    await expect(bar.getByRole("button", en["harnessBar.compact"], { exact: true })).toHaveCount(0);
    await wipe.tap();
    await expect(bar.getByRole("button", /Tap again to confirm \/clear/)).toBeVisible();
    await expect(field).toHaveValue("");
    expect(watched.writes).toEqual([]);
    await bar.getByRole("button", /Tap again to confirm \/clear/).tap();
    await expect.poll(() => watched.writes.some((write) => mentionsCommand(write, "/clear"))).toBe(true);
    await expect(field).toHaveValue("");
    expect(watched.writes.filter((write) => mentionsCommand(write, "/clear"))).toHaveLength(1);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("operator-bar-wipe-v1", { origin, writes: watched.writes, escapedOrigins: watched.escapedOrigins });
  }
});

test("switcher-tie-order/v1 — equal timestamps keep the order the bridge sent", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  try {
    await serveSnapshot(cloneSnapshot(tiedRecentAgents));
    await app.open("/");
    await screen.getByRole("button", /Nothing needs you/).tap();
    const dialog = screen.getByRole("dialog", en["chat.switcher.title"]);
    const rows = await dialog.getByRole("button", /proj/).all();
    const ids = rowIds(await Promise.all(rows.map((row) => row.getAttribute("id"))));
    expect(ids).toEqual(["switch-row-__first", "switch-row-__second"]);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("switcher-tie-order-v1", { origin, escapedOrigins: watched.escapedOrigins });
  }
});

test("switcher-untimed-sinks/v1 — a pane with no timestamp follows one that has one", async ({ app, screen }) => {
  const origin = new URL(app.baseUrl ?? "").origin;
  const watched = watchApi(origin);
  const untimed = untimedBridgeAgents.find((agent) => agent.paneId === "i1");
  const timed = tiedRecentAgents[0];
  if (untimed === undefined || timed === undefined || timed.paneId !== "first") {
    throw new Error("sweep inputs no longer contain idle i1 and tied first");
  }
  try {
    await serveSnapshot(cloneSnapshot([untimed, timed]));
    await app.open("/");
    await screen.getByRole("button", /Nothing needs you/).tap();
    const dialog = screen.getByRole("dialog", en["chat.switcher.title"]);
    const rows = await dialog.getByRole("button", /proj/).all();
    const ids = rowIds(await Promise.all(rows.map((row) => row.getAttribute("id"))));
    expect(ids).toEqual(["switch-row-__first", "switch-row-__i1"]);
    expect(watched.escapedOrigins).toEqual([]);
  } finally {
    writeEvidence("switcher-untimed-sinks-v1", { origin, escapedOrigins: watched.escapedOrigins });
  }
});
