// The recap file a Claude Code plugin writes beside the journal: `~/.cache/cc-recap/<sessionId>.json`.
// It lives here, under bridge/journal/, because it is
// the same kind of read as a transcript and obeys the same law (files.ts): the session id comes from
// Herdr, never the client, it is pattern-checked before it touches a path, and the built path is put
// through `containedRealpath` with the recap directory as its root.
//
// Missing, unreadable, escaping or malformed all read as "no recap", never an error.

import { homedir } from "node:os";
import { join } from "node:path";
import type { JsonValue } from "../json.ts";
import { clipLine, type Recap } from "../description/resolve.ts";
import { asRecord, asText } from "./cache-probe.ts";
import { containedRealpath, statFile } from "./files.ts";

export const DEFAULT_RECAP_DIR = join(homedir(), ".cache", "cc-recap");

const RECAP_ID_RE = /^[A-Za-z0-9-]+$/;
const RECAP_MAX_BYTES = 64 * 1024;
const FIELD_MAX = 80;

/** The contained real path of a session's recap file, or null. */
export async function recapPath(dir: string, sessionId: string): Promise<string | null> {
  if (!RECAP_ID_RE.test(sessionId)) return null;
  return containedRealpath(join(dir, `${sessionId}.json`), dir);
}

/** Size + mtime of a session's recap file, or null when there is none to read. */
export async function statRecap(
  dir: string,
  sessionId: string,
): Promise<{ path: string; size: number; mtimeMs: number } | null> {
  const path = await recapPath(dir, sessionId);
  if (path === null) return null;
  const st = await statFile(path);
  return st === null ? null : { path, ...st };
}

/** Read a recap file already resolved by {@link statRecap}. Throws only on an I/O failure. */
export async function readRecap(path: string): Promise<Recap | undefined> {
  const text = await Bun.file(path).slice(0, RECAP_MAX_BYTES).text();
  return parseRecap(text);
}

/** A recap file's body, or undefined for anything that is not one. Never throws. */
export function parseRecap(text: string): Recap | undefined {
  let raw: JsonValue;
  try {
    // SAFETY: `JSON.parse` output IS a JsonValue by construction; every read below is guarded.
    raw = JSON.parse(text) as JsonValue;
  } catch {
    return undefined;
  }
  const r = asRecord(raw);
  if (r === null) return undefined;
  const at = r.at;
  const now = asText(r.now)?.trim();
  if (typeof at !== "number" || !Number.isFinite(at) || now === undefined || now === "") return undefined;
  const recap: Recap = { at, now: clipLine(now, FIELD_MAX) };
  const goal = asText(r.goal)?.trim();
  const next = asText(r.next)?.trim();
  if (goal !== undefined && goal !== "") recap.goal = clipLine(goal, FIELD_MAX);
  if (next !== undefined && next !== "") recap.next = clipLine(next, FIELD_MAX);
  return recap;
}
