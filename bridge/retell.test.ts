import { describe, expect, test } from "bun:test";

import { parseRetellOutput, retellArgv, runRetell, validateRetellConfig, type RetellSpawn } from "./retell.ts";

const SID = "1519794a-e8f5-4a29-a687-f3154a08c1b2";
const answer = (over: Record<string, string | boolean> = {}) =>
  JSON.stringify({
    ok: true,
    sessionId: SID,
    mode: "plain",
    label: "白話",
    key: "k",
    answer: "重講",
    source: "http:m",
    cached: false,
    ...over,
  });

const spawnPrinting = (stdout: string, argvSeen: string[][] = []): RetellSpawn => (argv) => {
  argvSeen.push([...argv]);
  return { exited: Promise.resolve(0), stdout: Promise.resolve(stdout), kill: () => {} };
};

describe("validateRetellConfig", () => {
  test("an argv array turns retell on; anything else keeps it off", () => {
    const warn = () => {};
    expect(validateRetellConfig({ command: ["/bin/ww", "--source", "http"] }, warn)).toEqual([
      { command: ["/bin/ww", "--source", "http"] },
    ]);
    expect(validateRetellConfig({ command: "ww --source http" }, warn)).toEqual([]);
    expect(validateRetellConfig({ command: ["ww", 3] }, warn)).toEqual([]);
    expect(validateRetellConfig({}, warn)).toEqual([]);
  });
});

describe("retellArgv", () => {
  test("plain asks for the last turn, lost for the whole session; the id is always the bridge's", () => {
    const config = { command: ["/bin/ww"] };
    expect(retellArgv(config, "plain", SID, false)).toEqual(["/bin/ww", "1", "--session-id", SID, "--json"]);
    expect(retellArgv(config, "lost", SID, true)).toEqual(["/bin/ww", "--session-id", SID, "--json", "--no-cache"]);
  });
});

describe("parseRetellOutput", () => {
  test("a malformed or failed body is a failure, never a partial answer", () => {
    expect(parseRetellOutput("not json").ok).toBe(false);
    expect(parseRetellOutput(JSON.stringify({ ok: false, error: "proxy down" }))).toEqual({ ok: false, error: "proxy down" });
    expect(parseRetellOutput(answer({ answer: "  " })).ok).toBe(false);
    expect(parseRetellOutput(answer())).toEqual({
      ok: true,
      sessionId: SID,
      mode: "plain",
      label: "白話",
      answer: "重講",
      cached: false,
      source: "http:m",
    });
  });
});

describe("runRetell", () => {
  test("an answer for another session is refused", async () => {
    const other = "00000000-0000-0000-0000-000000000000";
    const result = await runRetell(spawnPrinting(answer({ sessionId: other })), ["ww"], { sessionId: SID, mode: "plain" });
    expect(result).toEqual({ ok: false, error: "retell answered for a different session" });
  });

  test("a hung child is asked to stop at the timeout, then killed when it does not", async () => {
    const signals: (number | undefined)[] = [];
    const hung: RetellSpawn = () => ({
      exited: new Promise(() => {}),
      stdout: new Promise(() => {}),
      kill: (signal?: number) => void signals.push(signal),
    });
    const result = await runRetell(hung, ["ww"], { sessionId: SID, mode: "plain" }, 5, 5);
    expect(result).toEqual({ ok: false, error: "retell took longer than 0s" });
    expect(signals).toEqual([undefined, 9]);
  });

  test("a child that exits non-zero is a failure with its own stderr, even with a valid answer", async () => {
    const failing: RetellSpawn = () => ({
      exited: Promise.resolve(2),
      stdout: Promise.resolve(answer()),
      stderr: Promise.resolve("usage: ww [-h]\nww: error: unrecognized arguments: --session-id\n"),
      kill: () => {},
    });
    const result = await runRetell(failing, ["ww"], { sessionId: SID, mode: "plain" });
    expect(result).toEqual({
      ok: false,
      error: "retell exited with status 2: usage: ww [-h] ww: error: unrecognized arguments: --session-id",
    });
  });

  test("output the child could not finish handing over is a failure, not a partial answer", async () => {
    const flooding: RetellSpawn = () => ({
      exited: Promise.resolve(0),
      stdout: Promise.reject(new Error("output over 1048576 bytes")),
      kill: () => {},
    });
    const result = await runRetell(flooding, ["ww"], { sessionId: SID, mode: "plain" });
    expect(result).toEqual({ ok: false, error: "unreadable retell output: output over 1048576 bytes" });
  });

  test("a spawn that throws is a failure with the program's name", async () => {
    const missing: RetellSpawn = () => {
      throw new Error("ENOENT");
    };
    const result = await runRetell(missing, ["/nope/ww"], { sessionId: SID, mode: "lost" });
    expect(result).toEqual({ ok: false, error: "could not start /nope/ww: Error: ENOENT" });
  });
});
