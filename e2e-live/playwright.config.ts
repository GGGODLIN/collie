// Fork-only live e2e: drives the ACTIVE Collie through its tailnet front door, against a throwaway
// Herdr session (`collie-e2e`) that `session.sh up` builds and `session.sh down` removes.
//
// Deliberately outside web/e2e/live: upstream's Tier 2 may only point at the dev lane, and this
// suite points at the operator's own instance, with the operator's say-so (2026-09-25).
//
// Run from web/ so @playwright/test resolves to one copy:
//     cd web && bunx playwright test -c ../e2e-live/playwright.config.ts
//
// No import of @playwright/test here on purpose: a second resolution of it from this directory
// would load the package twice and Playwright refuses that.
import { execFileSync } from "node:child_process";

if (process.env.CI) {
  throw new Error("This suite drives the operator's live Collie and must never run in CI.");
}

/**
 * The front door, asked of Tailscale rather than written down: this repo is public, and a machine's
 * tailnet name does not belong in it. Plain 127.0.0.1 is not an option either — the bridge answers
 * 403 without the identity header that only `tailscale serve` adds.
 */
function frontDoor(): string {
  const fromEnv = process.env.COLLIE_E2E_BASE_URL;
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  const status: { Self?: { DNSName?: string } } = JSON.parse(
    execFileSync("tailscale", ["status", "--json"], { encoding: "utf8" }),
  );
  const host = status.Self?.DNSName?.replace(/\.$/u, "");
  if (host === undefined || host === "") {
    throw new Error("tailscale status reports no DNSName; set COLLIE_E2E_BASE_URL instead.");
  }
  return `https://${host}:${process.env.COLLIE_E2E_PORT ?? "8443"}`;
}

export default {
  testDir: ".",
  testMatch: /specs\/.*\.spec\.ts$/u,
  // One live bridge and one shared Herdr session: parallel runs would read the same state.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: frontDoor(),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    serviceWorkers: "block",
  },
  projects: [{ name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
};
