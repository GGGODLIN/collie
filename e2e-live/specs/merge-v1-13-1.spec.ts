// The flows the upstream v1.13.1 merge touched, on the live Collie, against the `collie-e2e` world
// (`session.sh up`). Trajectory: trajectories/merge-v1-13-1-2026-09-25.md
//
// Read-only on the operator's own session: every case stays under `?s=collie-e2e`. Nothing here
// taps the trust card's buttons, so no keystroke reaches a terminal.
import type { Page } from "@playwright/test";

import {
  E2E_SESSION,
  E2E_WORKSPACE,
  at,
  expect,
  footer,
  footerTab,
  message,
  openE2eDashboard,
  test,
} from "../fixtures";

const HOME = `/?s=${E2E_SESSION}`;
const PANES = new RegExp(`^${message("home.tabs.panes")}$`, "u");
const FOCUS = new RegExp(`^\\d* ?${message("home.tabs.focus")}`, "u");
const CHANGES = new RegExp(`^${message("changes.title")}$`, "u");
const NEEDS_YOU = message("status.label.blocked");
const SWITCH_PANE = message("chat.switcher.title");

const main = (page: Page) => page.getByRole("main");
/** The fork's summary line: every state counted, then the switcher it opens. */
const summary = (page: Page) => main(page).getByRole("button", { name: new RegExp(`^1 ${NEEDS_YOU} .*${SWITCH_PANE}$`, "u") });
/** A ccp-free agent's row, by its tab label. Its description is model-written, so only the name is pinned. */
const freeRow = (scope: ReturnType<Page["getByRole"]>, name: string) =>
  scope.getByRole("button", { name: new RegExp(`^claude logo ${name} `, "u") });
// Accessible names count the logo's alt text, and the shell tag is uppercase only in CSS.
const agentRow = (page: Page) => main(page).getByRole("button", { name: new RegExp(`^claude logo agent .+ ${NEEDS_YOU}$`, "u") });
const shellRow = (page: Page) => main(page).getByRole("button", { name: /^shell shell$/u });
const switcher = (page: Page) => page.getByRole("dialog", { name: SWITCH_PANE });
/** A switcher section heading. Text content drops the space before the count (its own span), hence `\s*`. */
const section = (key: Parameters<typeof message>[0], n: number) => new RegExp(`^${message(key)}\\s*\\(${n}\\)$`, "u");

/**
 * The description the bridge wrote for the agent pane, read off its dashboard row's accessible name.
 * `textContent` would glue the row's spans together with no spaces, so the name comes from the
 * aria snapshot's first line instead: `- button "claude logo agent <description> needs you":`.
 */
async function agentDescription(page: Page): Promise<string> {
  const snapshot = await agentRow(page).ariaSnapshot();
  const m = new RegExp(`^- button "claude logo agent (.+) ${NEEDS_YOU}"`, "u").exec(snapshot);
  expect(m, `agent row snapshot reads ${snapshot}`).not.toBeNull();
  return m![1]!;
}

test.describe("merge v1.13.1 on the live Collie", () => {
  test.beforeEach(async ({ page }) => {
    await openE2eDashboard(page);
  });

  test("the dashboard shows the e2e world: one shell, one agent that needs you", async ({ page }) => {
    await expect(main(page).getByRole("heading", { name: E2E_WORKSPACE })).toBeVisible();
    await expect(shellRow(page)).toBeVisible();
    await expect(agentRow(page)).toBeVisible();
    await expect(footerTab(page, PANES)).toHaveAttribute("aria-current", "page");
    await expect(footerTab(page, FOCUS)).toHaveAccessibleName(/1 blocked/u);
  });

  test("the summary opens the switcher, which lists agents only and repeats the description", async ({ page }) => {
    const description = await agentDescription(page);
    await summary(page).click();
    await expect(switcher(page)).toBeVisible();
    await expect(switcher(page).getByRole("button", { name: `claude logo agent ${description}` })).toBeVisible();
    await expect(switcher(page).getByRole("button", { name: /^shell/u })).toHaveCount(0);
  });

  test("choosing from the switcher opens the pane, and back goes up to the dashboard", async ({ page }) => {
    const description = await agentDescription(page);
    await summary(page).click();
    await switcher(page).getByRole("button", { name: `claude logo agent ${description}` }).click();
    await expect.poll(() => at(page)).toMatch(new RegExp(`^/pane/[^?]+\\?s=${E2E_SESSION}$`, "u"));
    await expect(switcher(page)).toHaveCount(0);
    // The trust question is drawn as a card; asserted only, never tapped.
    await expect(page.getByRole("button", { name: /Yes, I trust this folder/u })).toBeVisible();

    await page.goBack();
    await expect.poll(() => at(page)).toBe(HOME);
    await expect(footerTab(page, PANES)).toHaveAttribute("aria-current", "page");
  });

  test("the switcher orders its sections, and the latest state change leads inside one (ADR 0072)", async ({ page }) => {
    await summary(page).click();
    const dialog = switcher(page);
    await expect(dialog).toBeVisible();
    const sections = [
      section("status.section.needsYou", 1),
      section("status.section.readyUnseen", 2),
      section("status.section.recent", 1),
      section("status.section.working", 1),
    ];
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(sections);
    // Rows in reading order, reduced to their tab label: ready-new changed state after ready-old.
    // The rows are still found by role; their TEXT is read only because an order assertion needs
    // the list in DOM order, and a name regex per row cannot say "before". The prefix match on the
    // tab label ignores the model-written description after it.
    const rows =await dialog.getByRole("button", { name: /^claude logo /u }).allTextContents();
    const labels = rows.map((r) => /^(agent|ready-new|ready-old|recent|working)/u.exec(r.trim())?.[1] ?? r);
    expect(labels).toEqual(["agent", "ready-new", "ready-old", "recent", "working"]);
  });

  test("Focus keeps what needs you and what finished unseen, and drops the rest", async ({ page }) => {
    await footerTab(page, FOCUS).click();
    await expect(footerTab(page, FOCUS)).toHaveAttribute("aria-current", "page");
    await expect(agentRow(page)).toBeVisible();
    await expect(freeRow(main(page), "ready-old")).toBeVisible();
    await expect(freeRow(main(page), "ready-new")).toBeVisible();
    await expect(freeRow(main(page), "recent")).toHaveCount(0);
    await expect(freeRow(main(page), "working")).toHaveCount(0);
    await expect(shellRow(page)).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: message("space.overview.new.aria") })).toHaveCount(0);
    // The summary line stays put above every tab (ADR 0066).
    await expect(summary(page)).toBeVisible();
  });

  test("Changes counts the workspace, opens its files, and the back arrow returns home", async ({ page }) => {
    await footerTab(page, CHANGES).click();
    const list = main(page).getByRole("list", { name: message("home.changes.listAria") });
    const row = list.getByRole("button", { name: new RegExp(`^${E2E_WORKSPACE} 2 files \\+2 −0$`, "u") });
    await expect(row).toBeVisible();

    await row.click();
    await expect.poll(() => at(page)).toMatch(new RegExp(`^/space/[^/]+/changes\\?s=${E2E_SESSION}$`, "u"));
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`${E2E_WORKSPACE}$`, "u") })).toBeVisible();
    await expect(page.getByRole("button", { name: `${message("changes.status.M")} notes.md +1 −0` })).toBeVisible();
    await expect(page.getByRole("button", { name: `${message("changes.status.untracked")} added.txt +1 −0` })).toBeVisible();

    await page.getByRole("button", { name: message("changes.backAria.dashboard") }).click();
    await expect.poll(() => at(page)).toBe(HOME);
    await expect(footer(page)).toBeVisible();
  });
});
