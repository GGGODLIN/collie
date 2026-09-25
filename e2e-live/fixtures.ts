// Every environment answer this suite needs, in one place. Specs import `test` from here and carry
// only business steps and assertions.
//
// Built on upstream's Tier 2 harness (web/e2e/live/live.ts), which already forces English before
// the first navigation, so these cases read the app's own strings through `message()`.
import type { Page } from "@playwright/test";

import { expect, message, test as live } from "../web/e2e/live/live";
import { TOUR_STORAGE_KEY, TOUR_VERSION } from "../web/src/lib/tour";

/** The throwaway Herdr session `session.sh up` builds. The dashboard reads it through `?s=`. */
export const E2E_SESSION = "collie-e2e";
/** The workspace `session.sh up` gives the scratch repo. */
export const E2E_WORKSPACE = "e2e-fixture";

/** How many agents of each status `session.sh up` leaves behind. Recent's pane is `done` in Herdr. */
const WORLD = { blocked: 1, done: 3, working: 1 } satisfies Record<string, number>;

interface WorldAgent {
  readonly status?: string;
}

export const test = live.extend<{ world: void }>({
  // Checked before every case, not once: the Working pane is a `sleep` inside Claude's Bash tool,
  // which that tool caps at ten minutes, after which it turns `done` and every count moves. A
  // drifted world must read as a drifted world, never as an app regression.
  world: [
    async ({ request }, use) => {
      const response = await request.get(`/api/snapshot?session=${E2E_SESSION}`);
      expect(response.ok(), "the e2e session is not up; run e2e-live/session.sh up").toBeTruthy();
      const body: { agents: readonly WorldAgent[] } = await response.json();
      const counts: Record<string, number> = {};
      for (const a of body.agents) counts[a.status ?? "unknown"] = (counts[a.status ?? "unknown"] ?? 0) + 1;
      expect(counts, "the e2e world drifted; rebuild it with session.sh down && session.sh up").toEqual(WORLD);
      await use();
    },
    { auto: true },
  ],
  page: async ({ page }, use) => {
    // A fresh browser context has never seen the first-run screen, and that full-screen dialog
    // intercepts every tap under it (trajectory: env trap 2).
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [TOUR_STORAGE_KEY, String(TOUR_VERSION)],
    );
    await use(page);
  },
});

export { expect, message };

/** The test session's dashboard. Never the operator's own session. */
export async function openE2eDashboard(page: Page): Promise<void> {
  await page.goto(`/?s=${E2E_SESSION}`);
  await expect(footer(page)).toBeVisible();
}

export const footer = (page: Page) => page.getByRole("navigation", { name: message("home.tabs.aria") });

export const footerTab = (page: Page, name: RegExp) => footer(page).getByRole("button", { name });

/** The app path the page is on: pathname plus query. */
export function at(page: Page): string {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
}
