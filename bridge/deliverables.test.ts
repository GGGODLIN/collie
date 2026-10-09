import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { crewRouteFor } from "./crew/forward.ts";
import {
  filesPathFor,
  linksInText,
  listDeliverables,
  MAX_DELIVERABLES,
  openDeliverable,
  parseLocalFileUrl,
  pathForToken,
  sessionBind,
} from "./deliverables.ts";
import { MAX_FILES_READ_BYTES, NODE_FILES_FS, type FilesFs } from "./files-view.ts";
import { HOST, hostFor } from "./host.ts";
import type { TranscriptEntry } from "./journal/types.ts";

const posix = hostFor("darwin");
const win = hostFor("win32");
const nativeHome = homedir();
const session = sessionBind({ kind: "id", value: "sess-1" });
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "collie-deliverable-"));
  dirs.push(dir);
  return dir;
}

function reply(text: string, uuid = "turn-1"): TranscriptEntry {
  return { uuid, ts: "", role: "assistant", parts: [{ kind: "text", text }] };
}

describe("parseLocalFileUrl", () => {
  test("decodes a local file URL once, including a space and UTF-8", () => {
    expect(parseLocalFileUrl("file:///tmp/a%20b.txt", posix)).toBe("/tmp/a b.txt");
    expect(parseLocalFileUrl("file:///tmp/%E4%B8%AD.txt", posix)).toBe("/tmp/中.txt");
    expect(parseLocalFileUrl("file:///tmp/a%2520b", posix)).toBe("/tmp/a%20b");
    expect(parseLocalFileUrl("file://localhost/tmp/a", posix)).toBe("/tmp/a");
  });

  test("refuses another host, traversal, NUL, and a drive letter on POSIX", () => {
    expect(parseLocalFileUrl("file://files.example/tmp/a", posix)).toBeNull();
    expect(parseLocalFileUrl("file:///tmp/../etc/passwd", posix)).toBeNull();
    expect(parseLocalFileUrl("file:///tmp/%2e%2e/passwd", posix)).toBeNull();
    expect(parseLocalFileUrl("file:///tmp/a%00b", posix)).toBeNull();
    expect(parseLocalFileUrl("file:///C:/Windows/note.txt", posix)).toBeNull();
    expect(parseLocalFileUrl("file:///tmp/a?x=1", posix)).toBeNull();
  });

  test("a Windows drive URL is a Windows path, and a POSIX URL is not", () => {
    expect(parseLocalFileUrl("file:///C:/Users/a%20b.txt", win)).toBe("C:\\Users\\a b.txt");
    expect(parseLocalFileUrl("file:///tmp/a", win)).toBeNull();
  });

  test("a line fragment is a location, not part of the name", () => {
    expect(parseLocalFileUrl("file:///tmp/report.md#L16", posix)).toBe("/tmp/report.md");
    expect(parseLocalFileUrl("file:///tmp/report.md#L16-L20", posix)).toBe("/tmp/report.md");
    expect(parseLocalFileUrl("file:///C:/Users/a.txt#L16", win)).toBe("C:\\Users\\a.txt");
    expect(parseLocalFileUrl("file:///tmp/report.md#top", posix)).toBeNull();
    expect(parseLocalFileUrl("file:///tmp/report.md#L16-L20-L30", posix)).toBeNull();
    expect(parseLocalFileUrl("file:///tmp/report.md#L16?x=1", posix)).toBeNull();
  });

  test("an encoded hash stays in the name, and a decoded backslash is not a Windows path", () => {
    expect(parseLocalFileUrl("file:///tmp/a%23b.txt", posix)).toBe("/tmp/a#b.txt");
    expect(parseLocalFileUrl("file:///tmp/a%23b.txt#L16", posix)).toBe("/tmp/a#b.txt");
    expect(parseLocalFileUrl("file:///C:/temp/x%5c..%5csecret.txt", win)).toBeNull();
  });
});

describe("listDeliverables", () => {
  const outside = "see [report](file:///tmp/roadmap-validation.json) done";

  test("an assistant reply names a file URL, and the other roles do not", () => {
    const entries: TranscriptEntry[] = [
      reply(outside),
      { uuid: "u", ts: "", role: "user", parts: [{ kind: "text", text: outside }] },
      { uuid: "n", ts: "", role: "note", parts: [{ kind: "text", text: outside }] },
      { uuid: "s", ts: "", role: "summary", parts: [{ kind: "text", text: outside }] },
      {
        uuid: "think",
        ts: "",
        role: "assistant",
        parts: [{ kind: "thinking", text: outside }],
      },
      {
        uuid: "tool",
        ts: "",
        role: "assistant",
        parts: [{ kind: "tool", name: "Bash", summary: "ran", result: { text: outside } }],
      },
      { ...reply(outside, "gone"), abandoned: true },
    ];
    const list = listDeliverables(entries, session, posix, "/Users/me", false);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.href).toBe("file:///tmp/roadmap-validation.json");
    expect(list.items[0]?.title).toBe("roadmap-validation.json");
    expect(list.items[0]?.id.includes("/tmp/")).toBe(false);
  });

  test("a later session does not select the old id", () => {
    const entries = [reply(outside)];
    const id = listDeliverables(entries, session, posix, "/Users/me", false).items[0]!.id;
    expect(pathForToken(entries, session, id, posix, "/Users/me")).toBe("/tmp/roadmap-validation.json");
    expect(pathForToken(entries, sessionBind({ kind: "id", value: "sess-2" }), id, posix, "/Users/me")).toBeNull();
    expect(pathForToken(entries, session, `${id}.extra`, posix, "/Users/me")).toBeNull();
  });

  test("a clipped journal is reported instead of being read past the cap", () => {
    const list = listDeliverables([reply(outside)], session, posix, "/Users/me", true);
    expect(list.truncated).toBe(true);
    expect(list.items).toHaveLength(1);
  });

  test("the cap keeps the latest links and drops the older ones", () => {
    const text = Array.from({ length: MAX_DELIVERABLES + 2 }, (_, i) => `file:///tmp/f${i}.txt`).join(" ");
    const list = listDeliverables([reply(text)], session, posix, "/Users/me", false);
    expect(list.items).toHaveLength(MAX_DELIVERABLES);
    expect(list.truncated).toBe(true);
    expect(list.items[0]?.href).toBe("file:///tmp/f2.txt");
    expect(list.items.at(-1)?.href).toBe(`file:///tmp/f${MAX_DELIVERABLES + 1}.txt`);
    expect(list.items.some((item) => item.href === "file:///tmp/f0.txt")).toBe(false);
  });

  test("seventy oldest-first entries keep the newest deliverable", () => {
    const entries = Array.from({ length: 70 }, (_, i) => reply(`file:///tmp/f${i}.txt`, `turn-${i}`));
    const list = listDeliverables(entries, session, posix, "/Users/me", false);
    const hrefs = list.items.map((item) => item.href);
    expect(list.items).toHaveLength(MAX_DELIVERABLES);
    expect(list.truncated).toBe(true);
    expect(hrefs[0]).toBe("file:///tmp/f6.txt");
    expect(hrefs.at(-1)).toBe("file:///tmp/f69.txt");
    expect(hrefs).not.toContain("file:///tmp/f0.txt");
  });

  test("the id binds the href, so the same place naming another file selects nothing", () => {
    const first = [reply("see file:///tmp/a.txt")];
    const id = listDeliverables(first, session, posix, "/Users/me", false).items[0]!.id;
    expect(pathForToken([reply("see file:///tmp/b.txt")], session, id, posix, "/Users/me")).toBeNull();
    expect(pathForToken(first, session, id, posix, "/Users/me")).toBe("/tmp/a.txt");
    const forged = id.split(".");
    forged[5] = Buffer.from("file:///tmp/b.txt", "utf8").toString("base64url");
    expect(pathForToken(first, session, forged.join("."), posix, "/Users/me")).toBeNull();
  });

  test("the same uuid and two links are two ids, and each opens its own file", () => {
    const entries = [reply("see file:///tmp/a.txt", "same"), reply("see file:///tmp/b.txt", "same")];
    const list = listDeliverables(entries, session, posix, "/Users/me", false);
    expect(list.items).toHaveLength(2);
    expect(list.items[0]!.id).not.toBe(list.items[1]!.id);
    expect(pathForToken(entries, session, list.items[0]!.id, posix, "/Users/me")).toBe("/tmp/a.txt");
    expect(pathForToken(entries, session, list.items[1]!.id, posix, "/Users/me")).toBe("/tmp/b.txt");
  });

  test("a long href and session still round-trip, and the id is not a path", () => {
    const href = `file:///tmp/${"a".repeat(1800)}.txt`;
    const longSession = sessionBind({ kind: "path", value: `/Users/me/${"s".repeat(2500)}.jsonl` });
    const entries = [reply(`see ${href}`)];
    const id = listDeliverables(entries, longSession, posix, "/Users/me", false).items[0]!.id;
    expect(id.includes("/tmp/")).toBe(false);
    expect(pathForToken(entries, longSession, id, posix, "/Users/me")).toBe(`/tmp/${"a".repeat(1800)}.txt`);
  });
});

describe("openDeliverable", () => {
  test("reads the bytes of a file the reply named, outside any Files root", async () => {
    const dir = scratch();
    const file = join(dir, "roadmap-validation.json");
    const bytes = new TextEncoder().encode('{"ok":true,"via":"bash"}\n');
    writeFileSync(file, bytes);
    const entries = [reply(`wrote [it](${pathToFileURL(file).href})`)];
    const id = listDeliverables(entries, session, HOST, nativeHome, false).items[0]!.id;
    const preview = await openDeliverable({
      entries,
      session,
      token: id,
      mode: "preview",
      privateFolders: [],
      home: nativeHome,
      host: HOST,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.text).toBe('{"ok":true,"via":"bash"}\n');
    expect(preview.downloadable).toBe(true);
    const downloaded = await openDeliverable({
      entries,
      session,
      token: id,
      mode: "download",
      privateFolders: [],
      home: nativeHome,
      host: HOST,
    });
    expect(downloaded.ok && downloaded.bytes !== undefined && Buffer.from(downloaded.bytes).equals(Buffer.from(bytes))).toBe(true);
  });

  test("a missing file, a .git path, a state secret and a private folder are not a successful read", async () => {
    const dir = scratch();
    const secret = join(dir, "crew-trust.json");
    writeFileSync(secret, "nope");
    const alias = join(dir, "notes");
    symlinkSync(secret, alias);
    const aliasHref = pathToFileURL(alias).href;
    const gitHref = pathToFileURL(join(dir, ".git", "config")).href;
    const named = reply(`secret [s](${aliasHref}) and [g](${gitHref})`);
    const list = listDeliverables([named], session, HOST, nativeHome, false);
    const secretId = list.items.find((item) => item.href === aliasHref)?.id;
    const gitId = list.items.find((item) => item.href === gitHref)?.id;
    expect(secretId).toBeDefined();
    const denied = await openDeliverable({
      entries: [named],
      session,
      token: secretId!,
      mode: "preview",
      privateFolders: [],
      home: nativeHome,
      host: HOST,
    });
    expect(denied).toEqual({ ok: false, fault: "unavailable" });
    const git = await openDeliverable({
      entries: [named],
      session,
      token: gitId!,
      mode: "preview",
      privateFolders: [],
      home: nativeHome,
      host: HOST,
    });
    expect(git).toEqual({ ok: false, fault: "unavailable" });
    const missing = reply(pathToFileURL(join(dir, "does-not-exist-collie-deliverable.txt")).href);
    const gone = await openDeliverable({
      entries: [missing],
      session,
      token: listDeliverables([missing], session, HOST, nativeHome, false).items[0]!.id,
      mode: "download",
      privateFolders: [],
      home: nativeHome,
      host: HOST,
    });
    expect(gone).toEqual({ ok: false, fault: "unavailable" });
    const inside = join(dir, "plain.txt");
    writeFileSync(inside, "x");
    const insideReply = reply(pathToFileURL(inside).href);
    const hidden = await openDeliverable({
      entries: [insideReply],
      session,
      token: listDeliverables([insideReply], session, HOST, nativeHome, false).items[0]!.id,
      mode: "preview",
      privateFolders: [dir],
      home: nativeHome,
      host: HOST,
    });
    expect(hidden).toEqual({ ok: false, fault: "unavailable" });
  });

  test("a download over the cap is a fault and does not return the cut bytes", async () => {
    const opened: string[] = [];
    const fs: FilesFs = {
      ...NODE_FILES_FS,
      realpath: async (path) => path,
      lstat: async () => ({
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        size: MAX_FILES_READ_BYTES + 5,
        dev: 1,
        ino: 1,
      }),
      readHead: async (path) => {
        opened.push(path);
        return { bytes: new Uint8Array([1]), size: MAX_FILES_READ_BYTES + 5 };
      },
    };
    const entries = [reply("file:///tmp/big.bin")];
    const id = listDeliverables(entries, session, posix, "/Users/me", false).items[0]!.id;
    const read = await openDeliverable({
      entries,
      session,
      token: id,
      mode: "download",
      privateFolders: [],
      home: "/Users/me",
      host: posix,
      fs,
    });
    expect(read).toEqual({ ok: false, fault: "too-large", size: MAX_FILES_READ_BYTES + 5 });
    expect(opened).toEqual([]);
  });

  test("an unknown id does not open the path someone wrote into the token", async () => {
    const opened: string[] = [];
    const fs: FilesFs = {
      ...NODE_FILES_FS,
      readHead: async (path) => {
        opened.push(path);
        return null;
      },
    };
    const read = await openDeliverable({
      entries: [reply("file:///tmp/real.txt")],
      session,
      token: "v1.not-a-session.not-a-turn.0.0",
      mode: "download",
      privateFolders: [],
      home: "/Users/me",
      host: posix,
      fs,
    });
    expect(read).toEqual({ ok: false, fault: "unknown-path" });
    expect(opened).toEqual([]);
  });

  test("a symlink to an allowed file is the file it names", async () => {
    const dir = scratch();
    const target = join(dir, "report.md");
    writeFileSync(target, "PUBLIC");
    const link = join(dir, "alias.md");
    symlinkSync(target, link);
    const entries = [reply(pathToFileURL(link).href)];
    const id = listDeliverables(entries, session, HOST, nativeHome, false).items[0]!.id;
    const preview = await openDeliverable({
      entries,
      session,
      token: id,
      mode: "preview",
      privateFolders: [],
      home: nativeHome,
      host: HOST,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.text).toBe("PUBLIC");
  });

  test("a parent swapped for a symlink to a private folder is not the opened file", async () => {
    const dir = scratch();
    const published = join(dir, "published");
    const privateConfig = join(dir, "private-config");
    mkdirSync(published);
    mkdirSync(privateConfig);
    writeFileSync(join(published, "report.md"), "PUBLIC");
    writeFileSync(join(privateConfig, "report.md"), "PRIVATE_FIXTURE");
    const spelled = join(published, "report.md");
    const entries = [reply(pathToFileURL(spelled).href)];
    const id = listDeliverables(entries, session, HOST, nativeHome, false).items[0]!.id;
    let swapped = false;
    const fs: FilesFs = {
      ...NODE_FILES_FS,
      readHead: async (path, max, confirm) => {
        renameSync(published, join(dir, "published-old"));
        symlinkSync(privateConfig, published, "dir");
        swapped = true;
        return NODE_FILES_FS.readHead(path, max, confirm);
      },
    };
    const preview = await openDeliverable({
      entries,
      session,
      token: id,
      mode: "preview",
      privateFolders: [privateConfig],
      home: nativeHome,
      host: HOST,
      fs,
    });
    expect(swapped).toBe(true);
    expect(preview).toEqual({ ok: false, fault: "unavailable" });
  });
});

describe("filesPathFor", () => {
  test("an in-root file is root-relative, and one outside is not", async () => {
    const root = scratch();
    mkdirSync(join(root, "docs"));
    const file = join(root, "docs", "a.txt");
    writeFileSync(file, "hi");
    const outside = join(scratch(), "out.txt");
    writeFileSync(outside, "hi");
    expect(await filesPathFor(file, root, HOST)).toBe("docs/a.txt");
    expect(await filesPathFor(outside, root, HOST)).toBeNull();
  });
});

test("the route is not on the crew wire", () => {
  expect(crewRouteFor("/api/pane/w1:p1/deliverables")).toBeNull();
  expect(crewRouteFor("/api/pane/w1:p1/deliverables/v1.abc.def.0.1")).toBeNull();
  const src = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
  const at = src.indexOf("const deliverableMatch = pathname.match(PANE_DELIVERABLE_ROUTE);");
  const block = src.slice(at, at + 700);
  const gate = block.indexOf('caller.gate("device-read")');
  const resolve = block.indexOf("caller.resolve()");
  expect(gate).toBeGreaterThan(-1);
  expect(resolve).toBeGreaterThan(gate);
});

test("linksInText keeps the href the phone matches", () => {
  const found = linksInText("see [report](file:///tmp/a%20b.txt) and file:///tmp/c.txt", posix, "/Users/me");
  expect(found.map((link) => link.href)).toEqual(["file:///tmp/a%20b.txt", "file:///tmp/c.txt"]);
});

test("markdown, angle and bare file links keep a line fragment and an encoded hash", () => {
  const text = [
    "see [report](file:///tmp/report.md#L16)",
    "and <file:///tmp/angle.md#L16-L20>",
    "and file:///tmp/bare.md#L16",
    "and file:///tmp/hash%23name.txt",
  ].join(" ");
  const found = linksInText(text, posix, "/Users/me");
  expect(found.map((link) => link.href)).toEqual([
    "file:///tmp/report.md#L16",
    "file:///tmp/angle.md#L16-L20",
    "file:///tmp/bare.md#L16",
    "file:///tmp/hash%23name.txt",
  ]);
  expect(found.map((link) => link.path)).toEqual([
    "/tmp/report.md",
    "/tmp/angle.md",
    "/tmp/bare.md",
    "/tmp/hash#name.txt",
  ]);
  expect(linksInText("file:///tmp/a.txt#top", posix, "/Users/me")).toEqual([]);
  expect(linksInText("file:///tmp/a.txt?x=1", posix, "/Users/me")).toEqual([]);
});
