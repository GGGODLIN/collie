import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "e2e";
import { surfaceOf } from "@e2e-dev/web";

import { en } from "../../src/lib/i18n/messages/en.ts";
import { engine } from "./engine.ts";
import { test } from "./fixtures.ts";

interface ApiWrite {
  method: string;
  path: string;
  body: unknown;
}

test("palette-stage-and-send/v1 — ADR 9002: stage first, explicit Send only", async ({ app, screen, browser }) => {
  const live = surfaceOf(engine);
  if (live === undefined) throw new Error("No active TesterArmy browser");
  const writes: ApiWrite[] = [];
  const escapedOrigins: string[] = [];
  const pageErrors: string[] = [];
  const origin = new URL(app.baseUrl ?? "").origin;
  const page = live.page();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  live.context().on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) escapedOrigins.push(url.origin);
    if (url.pathname.startsWith("/api/") && request.method() !== "GET") {
      writes.push({ method: request.method(), path: url.pathname, body: request.postDataJSON() });
    }
  });
  let buildInfo: unknown;
  try {
    await app.open("/pane/w1:p1");
    const field = screen.getByRole("textbox", en["composer.placeholder.reply"]);
    const agent = screen.getByRole("button", en["composer.controls.agent"], { exact: true });
    const palette = screen.getByRole("dialog", en["commands.title"]);
    await expect(field).toBeVisible();
    await expect(agent).toBeVisible();
    buildInfo = await browser.evaluate(async () => {
      const response = await fetch("/build-info.json");
      if (!response.ok) throw new Error("The test server has no build identity");
      return response.json();
    });
    await app.screenshot("composer-before-selection");

    await agent.tap();
    await expect(palette).toBeVisible();
    await palette.getByRole("button", /^\/status\s/).tap();
    await expect(field).toHaveValue("/status");
    await expect(palette).toBeHidden();
    expect(writes).toEqual([]);

    await field.clear();
    await agent.tap();
    await expect(palette).toBeVisible();
    await palette.getByRole("button", /^\/compact\s/).tap();
    await expect(field).toHaveValue("/compact ");
    await expect(palette).toBeHidden();
    expect(writes).toEqual([]);
    await field.pressSequentially("regression");
    await expect(field).toHaveValue("/compact regression");
    expect(writes).toEqual([]);
    await app.screenshot("command-staged-not-submitted");

    await screen.getByRole("button", en["composer.send.sendAria"], { exact: true }).tap();
    await expect(field).toHaveValue("");
    expect(writes).toHaveLength(2);
    expect(writes).toMatchObject([
      { method: "POST", path: "/api/pane/w1%3Ap1/reply", body: { text: "/compact regression", submit: false } },
      { method: "POST", path: "/api/pane/w1%3Ap1/reply", body: { text: "", submit: true } },
    ]);
    expect(escapedOrigins).toEqual([]);
    expect(pageErrors).toEqual([]);
    await app.screenshot("explicit-send-completed");
  } finally {
    const output = resolve(import.meta.dirname, ".e2e", process.env.COLLIE_E2E_RUN_ID ?? "local");
    mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, "network-evidence.json"), JSON.stringify({ buildInfo, origin, writes, escapedOrigins, pageErrors }, null, 2));
  }
});
