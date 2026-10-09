// A file an agent's own reply named, opened from the phone (ADR 9006).
//
// This is NOT a fourth place a client-supplied value becomes a path. The request carries a pane id
// and an opaque id. The path is whatever this module finds again in that session's assistant reply.
// A field inside the id, including one literally named `path`, is never opened: the id only selects
// which already-parsed reply link to read. User text, a note, a summary, thinking, a tool's input or
// result, and a turn the agent abandoned do not name a file. Neither does a path the phone sends.
//
// The id binds the session the pane is on NOW, the link's place in that reply, and the href as the
// reply wrote it. The href only selects the link. The path is read again from the reply, so a field
// in the id is never opened. After the pane moves to another session the old id selects nothing.

import { isStateSecretName } from "./acl-policy.ts";
import { looksBinary } from "./changes.ts";
import { HOST, type Host, isInside, splitPath } from "./host.ts";
import type { TranscriptEntry } from "./journal/types.ts";
import {
  decodeFileText,
  isGitSegment,
  MAX_FILES_READ_BYTES,
  NODE_FILES_FS,
  sniffImageType,
  type FilesFs,
  type OpenedFile,
} from "./files-view.ts";

/** How many reply links one answer names. Past this the rest are absent and `truncated` says so. */
export const MAX_DELIVERABLES = 64;
/** A path longer than this is not a file an agent named; PATH_MAX, the Files view's own cap. */
const MAX_PATH_BYTES = 4096;
/**
 * The longest href an id will carry. A file URL may percent-encode every byte of a max-length path,
 * name `localhost`, and end in a line location. Longer than this is not a link, so the id of one
 * that is still decodes.
 */
const MAX_FRAGMENT_CHARS = "#L".length + 9 + "-L".length + 9;
const MAX_HREF_BYTES = "file://localhost".length + MAX_PATH_BYTES * 3 + MAX_FRAGMENT_CHARS;
/** `sessionBind` of a path ref: the kind, a colon, and a path at the cap above. */
const MAX_SESSION_BYTES = "path:".length + MAX_PATH_BYTES;
/** A turn uuid. Harness ids in this tree are 36 hex chars; this is room, not a hash. */
const MAX_UUID_BYTES = 256;

function base64UrlChars(bytes: number): number {
  return 4 * Math.ceil(bytes / 3);
}

/** `v1.<session>.<uuid>.<part>.<offset>.<href>`, each text field base64url, wide enough for the caps. */
const MAX_ID_CHARS =
  "v1".length +
  1 +
  base64UrlChars(MAX_SESSION_BYTES) +
  1 +
  base64UrlChars(MAX_UUID_BYTES) +
  1 +
  9 +
  1 +
  9 +
  1 +
  base64UrlChars(MAX_HREF_BYTES);

/** `#L16` or `#L16-L20` only. Anything else after `#` is not a location, so the URL is not a file. */
const LINE_FRAGMENT = /^#L\d{1,9}(?:-L\d{1,9})?$/;

/** A C0 control or DEL. Checked by code point so the scan does not need a control-character regex. */
function hasControl(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export interface DeliverableItem {
  /** Opaque. Not a path, and not something to decode and open. */
  id: string;
  /** The link as the reply wrote it, so the phone can match the text it already has. */
  href: string;
  /** The file's own name, for the sheet. Never the directory. */
  title: string;
  /**
   * Set only when the file's real path sits inside the pane's Files root. The phone may open that
   * root-relative path through Files. Absent means this route is the only reader, and it still
   * re-checks the reply rather than trusting this field.
   */
  filesPath?: string;
}

export interface DeliverableList {
  items: DeliverableItem[];
  /** The journal's head was clipped, or the reply named more links than {@link MAX_DELIVERABLES}. */
  truncated: boolean;
}

/** What a read found, or why it will not pretend the file arrived. */
export type DeliverableRead =
  | {
      ok: true;
      name: string;
      size: number;
      binary: boolean;
      truncated: boolean;
      text: string;
      /** False when the file is larger than the cap: a download must not send a cut body as success. */
      downloadable: boolean;
      bytes?: Uint8Array;
    }
  | { ok: false; fault: "unknown-path" }
  | { ok: false; fault: "unavailable" }
  | { ok: false; fault: "too-large"; size: number };

interface IdBody {
  v: 1;
  s: string;
  u: string;
  p: number;
  o: number;
  /** The href as written. Compared to the reply. Never opened. */
  h: string;
}

interface FoundLink {
  href: string;
  path: string;
  offset: number;
}

/** The session half of an id. Compared, never opened. */
export function sessionBind(ref: { kind: string; value: string }): string {
  return `${ref.kind}:${ref.value}`;
}

/**
 * The absolute path a local `file:` URL names on `host`, or null.
 *
 * One percent-decode, then a refusal: another host, a `?`, a `#` that is not `#L16` or `#L16-L20`,
 * NUL or another control, a `.` or `..` segment, an empty segment, a backslash (a Windows URL does
 * not get to hide `..` behind `%5c`), a drive letter on a host that has none, or a POSIX path on
 * Windows. Collapsing `..` would authorise a different file than the one written. `%23` is a `#` in
 * the name, decoded once, and is not a fragment.
 */
export function parseLocalFileUrl(raw: string, host: Host = HOST): string | null {
  const written = raw.trim();
  if (written === "" || hasControl(written)) return null;
  if (Buffer.byteLength(written) > MAX_HREF_BYTES) return null;
  const hash = written.indexOf("#");
  if (hash !== -1 && !LINE_FRAGMENT.test(written.slice(hash))) return null;
  const href = hash === -1 ? written : written.slice(0, hash);
  if (href === "" || /[?#]/.test(href)) return null;
  if (!/^file:/i.test(href)) return null;
  const rest = href.slice("file:".length);
  if (!rest.startsWith("//")) return null;
  const after = rest.slice(2);
  let hostName = "";
  let pathPart = after;
  if (!after.startsWith("/")) {
    const slash = after.indexOf("/");
    if (slash <= 0) return null;
    hostName = after.slice(0, slash);
    pathPart = after.slice(slash);
  }
  if (hostName !== "" && hostName.toLowerCase() !== "localhost") return null;
  const decoded = decodeOnce(pathPart);
  if (decoded === null || hasControl(decoded) || decoded.includes("\\")) return null;
  if (Buffer.byteLength(decoded) > MAX_PATH_BYTES) return null;
  const segments = decoded.split("/");
  if (segments[0] !== "") return null;
  for (const segment of segments.slice(1)) {
    if (segment === "" || segment === "." || segment === "..") return null;
  }
  if (host.platform === "win32") {
    const drive = /^\/([A-Za-z])[:|](\/.*)?$/.exec(decoded);
    if (drive === null) return null;
    const tail = (drive[2] ?? "").replaceAll("/", "\\");
    return `${drive[1]!.toUpperCase()}:${tail === "" ? "\\" : tail}`;
  }
  if (/^\/[A-Za-z]:/.test(decoded)) return null;
  return decoded;
}

/** Percent-decode once. A bare `%`, a bad hex pair, or bytes that are not UTF-8 is null. `%252e` stays `%2e`. */
function decodeOnce(input: string): string | null {
  const bytes: number[] = [];
  const enc = new TextEncoder();
  for (let i = 0; i < input.length; ) {
    if (input[i] === "%") {
      const hex = input.slice(i + 1, i + 3);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) return null;
      bytes.push(Number.parseInt(hex, 16));
      i += 3;
      continue;
    }
    const cp = input.codePointAt(i);
    if (cp === undefined) return null;
    const ch = String.fromCodePoint(cp);
    for (const byte of enc.encode(ch)) bytes.push(byte);
    i += ch.length;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

/**
 * The file a markdown destination names, or null when it is not a local file URL, a `~/` path or a
 * POSIX absolute path on a POSIX host. A relative path is left to the phone's Files links.
 */
export function pathOfDestination(dest: string, host: Host, home: string): string | null {
  const file = parseLocalFileUrl(dest, host);
  if (file !== null) return file;
  const trimmed = dest.trim();
  if (hasControl(trimmed) || trimmed.includes("\\")) return null;
  if (trimmed.startsWith("~/")) {
    const rest = trimmed.slice(2);
    const parts = rest.split("/");
    if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
    if (!host.path.isAbsolute(home)) return null;
    const joined = host.path.join(home, ...parts);
    return Buffer.byteLength(joined) > MAX_PATH_BYTES ? null : joined;
  }
  if (host.platform === "win32" || !trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  const parts = trimmed.split("/");
  if (parts.slice(1).some((part) => part === "" || part === "." || part === "..")) return null;
  return Buffer.byteLength(trimmed) > MAX_PATH_BYTES ? null : trimmed;
}

// The destinations a reply actually writes. Bounded, and the same shapes the phone's parser keeps:
// a markdown link, an angle-bracketed file URL, a bare file URL. A file URL inside a markdown link
// is consumed by the first alternative, so it is one link, not two.
const LINK_RE =
  /\[([^\]\n[]{0,500})\]\(\s{0,20}([^)\s]{1,2000})(?:\s{1,20}(?:"[^"\n]{0,300}"|'[^'\n]{0,300}'))?\s{0,20}\)|<(file:\/\/[^>\s]{1,2000})>|(?<![\w@/.-])(file:\/\/[^\s<>`"']*[^\s<>`"'.,:;!?)\]}])/gi;

/** Every local file one piece of reply text names, in order, with the offset of the destination. */
export function linksInText(text: string, host: Host, home: string): FoundLink[] {
  const found: FoundLink[] = [];
  const re = new RegExp(LINK_RE.source, LINK_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const dest = match[2] ?? match[3] ?? match[4];
    if (dest === undefined) continue;
    const path = pathOfDestination(dest, host, home);
    if (path === null) continue;
    const offset = match.index + match[0].indexOf(dest);
    found.push({ href: dest, path, offset });
  }
  return found;
}

function encodeId(body: IdBody): string {
  const session = Buffer.from(body.s, "utf8").toString("base64url");
  const uuid = Buffer.from(body.u, "utf8").toString("base64url");
  const href = Buffer.from(body.h, "utf8").toString("base64url");
  return `v1.${session}.${uuid}.${body.p}.${body.o}.${href}`;
}

function decodePiece(piece: string, maxBytes: number): string | null {
  if (piece === "" || !/^[A-Za-z0-9_-]+$/.test(piece)) return null;
  const text = Buffer.from(piece, "base64url").toString("utf8");
  if (text === "" || hasControl(text) || Buffer.byteLength(text) > maxBytes) return null;
  return text;
}

/**
 * The id's selector, or null. Six fixed fields. The last is the href the reply wrote, and it is a
 * selector only: a token with a path stuffed into any field does not decode, and the href field is
 * not a path this function returns.
 */
function decodeId(token: string): IdBody | null {
  if (token.length > MAX_ID_CHARS) return null;
  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== "v1") return null;
  const session = decodePiece(parts[1] ?? "", MAX_SESSION_BYTES);
  const uuid = decodePiece(parts[2] ?? "", MAX_UUID_BYTES);
  const href = decodePiece(parts[5] ?? "", MAX_HREF_BYTES);
  const part = parts[3] ?? "";
  const offset = parts[4] ?? "";
  if (session === null || uuid === null || href === null) return null;
  if (!/^\d{1,9}$/.test(part) || !/^\d{1,9}$/.test(offset)) return null;
  return { v: 1, s: session, u: uuid, p: Number(part), o: Number(offset), h: href };
}

function authorisingParts(entry: TranscriptEntry): { index: number; text: string }[] {
  if (entry.role !== "assistant" || entry.abandoned === true) return [];
  const parts: { index: number; text: string }[] = [];
  entry.parts.forEach((part, index) => {
    if (part.kind === "text") parts.push({ index, text: part.text });
  });
  return parts;
}

/**
 * The reply links this session authorises. The cap keeps the latest links and drops the older ones.
 * `truncated` is the journal clip OR that cap: either way something named further back is not in
 * `items`, and nothing here reads past the entries it was given to go find it.
 */
export function listDeliverables(
  entries: readonly TranscriptEntry[],
  session: string,
  host: Host,
  home: string,
  journalTruncated: boolean,
): DeliverableList {
  const picked: { uuid: string; part: number; link: FoundLink }[] = [];
  let overflow = false;
  for (let i = entries.length - 1; i >= 0 && !overflow; i--) {
    const entry = entries[i]!;
    const parts = authorisingParts(entry);
    for (let p = parts.length - 1; p >= 0 && !overflow; p--) {
      const part = parts[p]!;
      const links = linksInText(part.text, host, home);
      for (let l = links.length - 1; l >= 0; l--) {
        if (picked.length >= MAX_DELIVERABLES) {
          overflow = true;
          break;
        }
        picked.push({ uuid: entry.uuid, part: part.index, link: links[l]! });
      }
    }
  }
  const items: DeliverableItem[] = [];
  for (let i = picked.length - 1; i >= 0; i--) {
    const row = picked[i]!;
    items.push({
      id: encodeId({ v: 1, s: session, u: row.uuid, p: row.part, o: row.link.offset, h: row.link.href }),
      href: row.link.href,
      title: host.path.basename(row.link.path),
    });
  }
  return { items, truncated: journalTruncated || overflow };
}

/**
 * The path the reply records for `token`, looked up again from `entries`. Null when the session, the
 * turn, the place or the href does not match. The token is not a path. The href field only has to
 * equal a link the reply still has; the returned path is that link's path, never the field itself.
 */
export function pathForToken(
  entries: readonly TranscriptEntry[],
  session: string,
  token: string,
  host: Host,
  home: string,
): string | null {
  const id = decodeId(token);
  if (id === null || id.s !== session) return null;
  for (const entry of entries) {
    if (entry.uuid !== id.u || entry.role !== "assistant" || entry.abandoned === true) continue;
    const part = entry.parts[id.p];
    if (part === undefined || part.kind !== "text") continue;
    const link = linksInText(part.text, host, home).find(
      (candidate) => candidate.offset === id.o && candidate.href === id.h,
    );
    if (link !== undefined) return link.path;
  }
  return null;
}

/** A root-relative Files path when `file` really sits inside `root`, else null. Does not widen the root. */
export async function filesPathFor(
  file: string,
  root: string | null,
  host: Host,
  fs: FilesFs = NODE_FILES_FS,
): Promise<string | null> {
  if (root === null) return null;
  const rootReal = await fs.realpath(root).catch(() => null);
  const fileReal = await fs.realpath(file).catch(() => null);
  if (rootReal === null || fileReal === null) return null;
  const fold = host.caseInsensitive ? host : { ...host, caseInsensitive: true };
  if (!isInside(fold, fileReal, rootReal)) return null;
  const rel = host.path.relative(rootReal, fileReal);
  if (rel === "" || rel.startsWith("..") || host.path.isAbsolute(rel)) return null;
  return rel.split(host.path.sep).join("/");
}

function nameDenied(real: string, host: Host): boolean {
  const parts = splitPath(host, real).parts;
  if (parts.some((part) => isGitSegment(part))) return true;
  const base = parts.at(-1);
  return base !== undefined && isStateSecretName(base);
}

async function placeDenied(real: string, folders: readonly string[], host: Host, fs: FilesFs): Promise<boolean> {
  if (nameDenied(real, host)) return true;
  const fold = host.caseInsensitive ? host : { ...host, caseInsensitive: true };
  for (const folder of folders) {
    if (folder.trim() === "") continue;
    if (isInside(fold, real, folder)) return true;
    const resolved = await fs.realpath(folder).catch(() => null);
    if (resolved !== null && resolved !== folder && isInside(fold, real, resolved)) return true;
  }
  return false;
}

function samePath(a: string, b: string, host: Host): boolean {
  const fold = (value: string) => (host.caseInsensitive ? value.toLowerCase() : value);
  return fold(host.path.resolve(a)) === fold(host.path.resolve(b));
}

/** PDF, a picture, or a zip: bytes that must not be shown as text. A NUL is already `looksBinary`. */
function opaqueBytes(bytes: Uint8Array): boolean {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return true;
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return true;
  return sniffImageType(bytes) !== null;
}

/**
 * Open the one file `token` names in this session's reply.
 *
 * `mode: "download"` returns every byte or a fault. It never returns a cut body: past
 * {@link MAX_FILES_READ_BYTES} the fault is `too-large`. A preview may carry the start and
 * `truncated: true`, and then `downloadable` is false so the phone cannot save that start as the file.
 */
export async function openDeliverable(opts: {
  entries: readonly TranscriptEntry[];
  session: string;
  token: string;
  mode: "preview" | "download";
  privateFolders: readonly string[];
  home: string;
  host?: Host;
  fs?: FilesFs;
}): Promise<DeliverableRead> {
  const host = opts.host ?? HOST;
  const fs = opts.fs ?? NODE_FILES_FS;
  const spelled = pathForToken(opts.entries, opts.session, opts.token, host, opts.home);
  if (spelled === null) return { ok: false, fault: "unknown-path" };
  if (nameDenied(spelled, host)) return { ok: false, fault: "unavailable" };
  const real = await fs.realpath(spelled).catch(() => null);
  if (real === null) return { ok: false, fault: "unavailable" };
  if (await placeDenied(real, opts.privateFolders, host, fs)) return { ok: false, fault: "unavailable" };
  const st = await fs.lstat(real).catch(() => null);
  if (st === null || st.isSymbolicLink() || !st.isFile()) return { ok: false, fault: "unavailable" };
  if (opts.mode === "download" && st.size > MAX_FILES_READ_BYTES) return { ok: false, fault: "too-large", size: st.size };
  const head = await fs.readHead(real, MAX_FILES_READ_BYTES, async (opened: OpenedFile) => {
    if (opened.path !== null) {
      return samePath(opened.path, real, host) && !(await placeDenied(opened.path, opts.privateFolders, host, fs));
    }
    // No kernel name for the handle (not Linux). lstat of the path already resolved follows a parent
    // directory swapped for a symlink and then matches the opened inode, which is the private file.
    // Resolve the reply's spelling again; it must still be the file this function allowed. This runs
    // before any byte is read.
    const again = await fs.realpath(spelled).catch(() => null);
    if (again === null || !samePath(again, real, host)) return false;
    if (await placeDenied(again, opts.privateFolders, host, fs)) return false;
    const againStat = await fs.lstat(again).catch(() => null);
    if (againStat === null || againStat.isSymbolicLink() || !againStat.isFile()) return false;
    return (
      againStat.dev !== undefined &&
      againStat.ino !== undefined &&
      againStat.dev === opened.dev &&
      againStat.ino === opened.ino
    );
  });
  if (head === null) return { ok: false, fault: "unavailable" };
  if (head.size > MAX_FILES_READ_BYTES) {
    if (opts.mode === "download") return { ok: false, fault: "too-large", size: head.size };
  }
  const truncated = head.size > MAX_FILES_READ_BYTES;
  const binary = looksBinary(head.bytes) || opaqueBytes(head.bytes);
  const text = binary ? "" : decodeFileText(head.bytes, truncated).text;
  const body: DeliverableRead = {
    ok: true,
    name: host.path.basename(real),
    size: head.size,
    binary,
    truncated,
    text,
    downloadable: !truncated,
  };
  if (opts.mode === "download" && body.ok && body.downloadable) body.bytes = head.bytes;
  return body;
}

/** `content-disposition` for a download. The name is the basename only; a quote or a newline cannot break out. */
export function attachmentDisposition(name: string): string {
  const base = name.replace(/[\r\n"\\]/g, "").slice(0, 180);
  const ascii = base.replace(/[^\u0020-\u007e]/g, "_");
  const fallback = ascii === "" ? "download" : ascii;
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(base === "" ? "download" : base)}`;
}
