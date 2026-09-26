import { describe, expect, test } from "bun:test";

import { exitLineShown, settingsChangedSinceLastTurn, switchAccount, type SwitchClock } from "./account-switch.ts";
import { validateOperatorAccounts } from "./operator-accounts.ts";
import type { MuxAck, MuxGrid, MuxOutcome, MuxSnapshot } from "./mux/types.ts";

const SID = "1519794a-e8f5-4a29-a687-f3154a08c1b2";
const ok: MuxAck = { ok: true, value: undefined };

function fakeClock(): SwitchClock {
  let t = 0;
  return { sleep: async (ms) => void (t += ms), now: () => t };
}

/** A pane whose Claude exits `exitAfterPolls` snapshot reads after `/exit` is submitted. */
function fakeMux(opts: { exitAfterPolls: number | null; screenAfterExit?: string; launchFails?: boolean }) {
  const calls: string[] = [];
  let submittedExit = false;
  let polls = 0;
  const gone = () => submittedExit && opts.exitAfterPolls !== null && polls > opts.exitAfterPolls;
  const mux = {
    async sendKeys(_pane: string, keys: readonly string[]): Promise<MuxAck> {
      calls.push(`keys:${keys.join(",")}`);
      if (keys[0] === "Enter" && calls.at(-2) === "text:/exit") submittedExit = true;
      return ok;
    },
    async typeText(_pane: string, text: string): Promise<MuxAck> {
      calls.push(`text:${text}`);
      if (opts.launchFails && text.includes("--resume")) return { ok: false, reason: "refused", detail: "pane gone" };
      return ok;
    },
    async snapshot(): Promise<MuxSnapshot> {
      polls += submittedExit ? 1 : 0;
      // SAFETY: the switch reads only paneId and agent off a pane.
      const pane = { paneId: "w1:p1", agent: gone() ? "shell" : "claude" } as MuxSnapshot["panes"][number];
      return { panes: [pane], spaces: [], tabs: [] };
    },
    async readGrid(): Promise<MuxOutcome<MuxGrid>> {
      const text = gone()
        ? (opts.screenAfterExit ?? `Resume this session with:\nclaude --resume ${SID}\n\n❯`)
        : "╭ claude frame ╮\n❯ \n";
      // SAFETY: the switch reads only `text` off a grid.
      return { ok: true, value: { text } as MuxGrid };
    },
  };
  return { mux, calls };
}

const plan = (interrupt: boolean) => ({ paneId: "w1:p1", sessionId: SID, command: "cc -team-s", interrupt });

describe("switchAccount", () => {
  test("an idle pane: clear the box, /exit, wait for the exit, then resume on the new account", async () => {
    const { mux, calls } = fakeMux({ exitAfterPolls: 2 });
    expect(await switchAccount(mux, plan(false), fakeClock())).toEqual({ ok: true });
    expect(calls).toEqual(["keys:ctrl+c", "text:/exit", "keys:Enter", `text:cc -team-s --resume ${SID}`, "keys:Enter"]);
  });

  test("a working pane is interrupted once before the clearing ctrl+c", async () => {
    const { mux, calls } = fakeMux({ exitAfterPolls: 0 });
    expect(await switchAccount(mux, plan(true), fakeClock())).toEqual({ ok: true });
    expect(calls.slice(0, 3)).toEqual(["keys:ctrl+c", "keys:ctrl+c", "text:/exit"]);
  });

  test("an exit never confirmed starts nothing", async () => {
    const { mux, calls } = fakeMux({ exitAfterPolls: null });
    expect(await switchAccount(mux, plan(false), fakeClock())).toEqual({ ok: false, stage: "unconfirmed" });
    expect(calls.some((c) => c.includes("--resume"))).toBe(false);
  });

  test("a shell with no exit line for THIS session is not an exit", async () => {
    const { mux, calls } = fakeMux({ exitAfterPolls: 0, screenAfterExit: "claude --resume 00000000-0000-0000-0000-000000000000\n❯" });
    expect(await switchAccount(mux, plan(false), fakeClock())).toEqual({ ok: false, stage: "unconfirmed" });
    expect(calls.some((c) => c.includes("--resume"))).toBe(false);
  });

  test("a resume line the pane refused is reported as a launch failure, not retried", async () => {
    const { mux, calls } = fakeMux({ exitAfterPolls: 0, launchFails: true });
    expect(await switchAccount(mux, plan(false), fakeClock())).toEqual({ ok: false, stage: "launch", reason: "pane gone" });
    expect(calls.filter((c) => c.includes("--resume"))).toHaveLength(1);
  });
});

describe("exitLineShown", () => {
  test("an old exit line scrolled above the foot does not count", () => {
    const old = `claude --resume ${SID}\n` + Array.from({ length: 12 }, (_, i) => `line ${i}`).join("\n");
    expect(exitLineShown(old, SID)).toBe(false);
    expect(exitLineShown(`x\nclaude --resume ${SID}\n\n❯ `, SID)).toBe(true);
  });
});

describe("settingsChangedSinceLastTurn", () => {
  interface LogRow { type: string; message: { content: string | unknown[] } }
  const row = (o: LogRow) => JSON.stringify(o);
  const model = row({ type: "user", message: { content: "<command-name>/model</command-name>\n<command-args>sonnet</command-args>" } });
  const answer = row({ type: "assistant", message: { content: [] } });
  test("a /model after the last answer is pending; one before it is not", () => {
    expect(settingsChangedSinceLastTurn([answer, model].join("\n"))).toBe(true);
    expect(settingsChangedSinceLastTurn([model, answer].join("\n"))).toBe(false);
    expect(settingsChangedSinceLastTurn(["{torn", answer].join("\n"))).toBe(false);
  });
});

describe("validateOperatorAccounts", () => {
  test("keeps well-formed rows and drops the rest", () => {
    const warnings: string[] = [];
    const rows = validateOperatorAccounts(
      {
        accounts: [
          { label: "Team-P", command: "cc -team-p" },
          { label: "Team-S", command: "cc -team-s\nrm -rf ~" },
          { label: "", command: "cc" },
          { label: "Team-P", command: "cc -team-p --x" },
        ],
      },
      (m) => warnings.push(m),
    );
    expect(rows).toEqual([{ label: "Team-P", command: "cc -team-p --x" }]);
    expect(warnings).toHaveLength(3);
  });
});
