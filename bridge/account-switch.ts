import type { MuxAdapter } from "./mux/types.ts";

// Restart one Claude pane on another account, in the SAME pane, continuing the same session.
//
// This is the first Collie action that ends an agent and starts one, so every step is ordered to
// fail toward "nothing new started": the new process is typed only after the old one is PROVEN gone,
// because two Claude processes writing one transcript corrupt it. An unconfirmed exit returns an
// error and launches nothing; nothing here is ever retried.
//
// The sequence is the one measured on Claude Code 2.1.283 (2026-09-26):
//   • working → one ctrl+c interrupts the turn and puts the sent prompt back in the input box;
//   • ctrl+c on a non-empty input box clears it;
//   • `/exit` then exits and prints `claude --resume <id>`, and Herdr drops the pane's agent;
//   • `<account command> --resume <id>` restores the last turn's model, effort and 1M context.
// `/exit` is typed only once the screen shows an EMPTY input row: otherwise a draft the operator
// left there, or the prompt an interrupt handed back, would be submitted with `/exit` appended.

export interface SwitchPlan {
  readonly paneId: string;
  readonly sessionId: string;
  readonly command: string;
  /** The pane was working or blocked when the phone asked, so its turn is interrupted first. */
  readonly interrupt: boolean;
}

export type SwitchOutcome =
  | { readonly ok: true }
  /** Keys or text did not reach the pane before the old process was confirmed gone. */
  | { readonly ok: false; readonly stage: "exit"; readonly reason: string }
  /** The old process was never confirmed gone, so nothing was started. */
  | { readonly ok: false; readonly stage: "unconfirmed" }
  /** The old process is gone but the new line did not reach the pane. */
  | { readonly ok: false; readonly stage: "launch"; readonly reason: string };

export interface SwitchClock {
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
}

type SwitchMux = Pick<MuxAdapter, "sendKeys" | "typeText" | "readGrid" | "snapshot">;

/** Long enough for an interrupted turn to hand the input box back (measured under 2s). */
const INTERRUPT_SETTLE_MS = 1500;
/** Between the clearing ctrl+c and typing, so the keypress is not read as part of the text. */
const KEY_SETTLE_MS = 300;
/** Exit measured at under 4s; the bound leaves room for a slow Stop hook. */
const EXIT_CEILING_MS = 20_000;
const EXIT_POLL_MS = 500;
/** How far up the screen the printed resume line may sit and still belong to THIS exit. */
const EXIT_TAIL_LINES = 8;
/** Clearing ctrl+c presses tried before the switch gives up on an input row that stays full. */
const CLEAR_ATTEMPTS = 2;

/**
 * Whether Claude's input row is empty: the LOWEST `❯` row on screen, which is the input box's (the
 * transcript above echoes earlier prompts with the same mark). Null when no such row is on screen,
 * which the caller treats as "cannot tell" and refuses on.
 */
export function inputRowEmpty(screen: string): boolean | null {
  const rows = screen.split(/\r?\n/).filter((line) => line.trimStart().startsWith("❯"));
  const row = rows.at(-1);
  return row === undefined ? null : row.trim() === "❯";
}

/**
 * Whether the screen shows this session's own exit line at its foot.
 *
 * The tail bound is what stops an OLD exit of the same session from counting: the pane that ran
 * `cc --resume <id>` before holds that id higher up its scrollback, and a live Claude covers the
 * foot of the screen with its own frame.
 */
export function exitLineShown(screen: string, sessionId: string): boolean {
  const tail = screen
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(-EXIT_TAIL_LINES);
  return tail.some((line) => line.includes(`claude --resume ${sessionId}`));
}

/**
 * Whether the operator changed the model or effort after the session's last answer.
 *
 * `--resume` restores the settings of the last TURN, so such a change would be silently undone by a
 * switch; the route refuses instead and asks for one more message first. Pure over the log's text.
 */
export function settingsChangedSinceLastTurn(jsonl: string): boolean {
  let changed = false;
  for (const line of jsonl.split("\n")) {
    if (line.trim() === "") continue;
    let row: { type?: string; message?: { content?: string } };
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.type === "assistant") changed = false;
    else if (row.type === "user" && /<command-name>\/(?:model|effort)<\/command-name>/.test(row.message?.content ?? "")) {
      changed = true;
    }
  }
  return changed;
}

async function exited(mux: SwitchMux, plan: SwitchPlan, clock: SwitchClock): Promise<boolean> {
  const started = clock.now();
  for (;;) {
    await clock.sleep(EXIT_POLL_MS);
    try {
      const snapshot = await mux.snapshot();
      const pane = snapshot.panes.find((p) => p.paneId === plan.paneId);
      const read = await mux.readGrid(plan.paneId, { scope: "viewport", lines: 60, styling: "strip" });
      // Both, never either: the agent field can lag an exit, and the printed line can survive from an
      // exit whose process a second Claude replaced.
      if (pane !== undefined && pane.agent !== "claude" && read.ok && exitLineShown(read.value.text, plan.sessionId)) {
        return true;
      }
    } catch {
      // An unreadable pane mid-exit is "not yet", never proof of anything.
    }
    if (clock.now() - started >= EXIT_CEILING_MS) return false;
  }
}

export async function switchAccount(mux: SwitchMux, plan: SwitchPlan, clock: SwitchClock): Promise<SwitchOutcome> {
  const keys = async (k: readonly string[]) => {
    const sent = await mux.sendKeys(plan.paneId, k);
    return sent.ok ? null : sent.detail;
  };
  if (plan.interrupt) {
    const failed = await keys(["ctrl+c"]);
    if (failed !== null) return { ok: false, stage: "exit", reason: failed };
    await clock.sleep(INTERRUPT_SETTLE_MS);
  }
  for (let attempt = 0; ; attempt++) {
    const read = await mux.readGrid(plan.paneId, { scope: "viewport", lines: 60, styling: "strip" });
    const empty = read.ok ? inputRowEmpty(read.value.text) : null;
    if (empty === true) break;
    if (empty === null) return { ok: false, stage: "exit", reason: "Claude's input row is not on screen" };
    if (attempt >= CLEAR_ATTEMPTS) return { ok: false, stage: "exit", reason: "Claude's input row did not clear" };
    const cleared = await keys(["ctrl+c"]);
    if (cleared !== null) return { ok: false, stage: "exit", reason: cleared };
    await clock.sleep(KEY_SETTLE_MS);
  }
  const typed = await mux.typeText(plan.paneId, "/exit");
  if (!typed.ok) return { ok: false, stage: "exit", reason: typed.detail };
  await clock.sleep(KEY_SETTLE_MS);
  const submitted = await keys(["Enter"]);
  if (submitted !== null) return { ok: false, stage: "exit", reason: submitted };

  if (!(await exited(mux, plan, clock))) return { ok: false, stage: "unconfirmed" };

  const line = `${plan.command} --resume ${plan.sessionId}`;
  const launched = await mux.typeText(plan.paneId, line);
  if (!launched.ok) return { ok: false, stage: "launch", reason: launched.detail };
  await clock.sleep(KEY_SETTLE_MS);
  const run = await keys(["Enter"]);
  if (run !== null) return { ok: false, stage: "launch", reason: run };
  return { ok: true };
}
