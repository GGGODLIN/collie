import type { CreateResponse, DeviceAuth, Launcher, RetellResponse } from "@/lib/types";

// Original inputs moved here so the browser cases serve the same objects.
// The unit expects stay on these values; do not rebuild them there.

/** launch-strip.test.tsx:41 */
export const launchPeek = {
  command: "rumen-peek",
  label: "Runs & quota",
  cwd: "/home/op/project",
} as const satisfies Launcher;

/** launch-strip.test.tsx:42 */
export const launchQuota = {
  command: "showy-quota-peek",
  label: "Quota bars",
  cwd: "/home/op/project",
} as const satisfies Launcher;

/** launch-strip.test.tsx:43 — cwd absent, so the switcher says "here" and the dashboard does not. */
export const launchHere = { command: "htop", label: "Top" } as const satisfies Launcher;

/** launch-strip.test.tsx:95 — the home the strip shortens a pinned cwd against. */
export const launchHome = "/home/op";

/** launch-strip.test.tsx:23-32 and :140-143 — what the launch hook's success answer carries. */
export const launchSuccess = {
  ok: true,
  pane: {
    paneId: "p1",
    workspaceId: "w1",
    workspaceLabel: "peek",
    tabId: "t1",
    cwd: "/home",
  },
} as const satisfies Extract<CreateResponse, { ok: true }>;

/** launch-strip.test.tsx:166 — enforced and not authorized is the read-only record. */
export const launchReadOnly = {
  enforced: true,
  device: "phone",
  authorized: false,
} as const satisfies DeviceAuth;

/** pane-account-retell.test.tsx:155 — the finished Lost body, including source. */
export const retellLostDone = {
  ok: true,
  mode: "lost",
  label: "跟丟了",
  answer: "整段",
  cached: true,
  source: "x",
} as const satisfies RetellResponse;

/** pane-account-retell.test.tsx:166 — the sidecar's own words. */
export const retellFailedReason = "could not start /nope/ww: Error: ENOENT";

/** pane-account-retell.test.tsx:169 — Plain's configured-but-broken reply. */
export const retellPlainFailed = {
  ok: false,
  error: retellFailedReason,
  code: "retell.failed",
  detail: { reason: retellFailedReason },
} as const satisfies RetellResponse;
