import type { JsonObject } from "./json.ts";
import { hasControlChar } from "./operator-launchers.ts";
import { createOperatorFileReader, diskIo, type OperatorFileIo } from "./operator-file.ts";

// The operator's Claude accounts, read from `accounts.toml` next to `launchers.toml` — the same
// reader, the same mtime liveness, the same drop-the-row failure posture.
//
// The list is the allowlist `POST /api/pane/:id/switch-account` matches: the phone names a row by
// its `label` and the bridge types that row's `command`, then `--resume <id>` with the id the
// multiplexer reported for the pane. The client supplies neither a command line nor a session id.
//
// Why no model or effort field: `claude --resume` restores the model, effort and 1M context of the
// session's last turn by itself (measured 2026-09-26), so the bridge passes none and cannot put a
// global default where the session's own setting was.

/** One `[[accounts]]` row. */
export interface Account {
  readonly label: string;
  /** The shell line that starts Claude on this account, e.g. `cc -team-p`. Typed verbatim. */
  readonly command: string;
}

interface AccountsDocument {
  accounts?: unknown;
}

/**
 * Turn a parsed `accounts.toml` into rows, dropping anything malformed with one warning line.
 *
 * ```toml
 * [[accounts]]
 * label = "Team-P"         # required; what the phone shows and sends back
 * command = "cc -team-p"   # required; typed verbatim, then ` --resume <session id>`
 * ```
 *
 * A later row with the same label replaces the earlier one in place.
 */
export function validateOperatorAccounts(
  doc: AccountsDocument | null | undefined,
  warn = defaultWarn,
): Account[] {
  const rows = doc?.accounts;
  if (rows === undefined || rows === null) return [];
  if (!Array.isArray(rows)) {
    warn("`accounts` must be an array of [[accounts]] tables — ignoring the file's rows");
    return [];
  }
  const out: Account[] = [];
  const at = new Map<string, number>();
  for (const raw of rows) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      warn("ignoring a row that is not an [[accounts]] table");
      continue;
    }
    const row: JsonObject = raw;
    if (typeof row.label !== "string" || row.label.trim() === "") {
      warn(`ignoring a row whose label is missing or empty: ${JSON.stringify(row.label)}`);
      continue;
    }
    const label = row.label.trim();
    if (typeof row.command !== "string" || row.command.trim() === "") {
      warn(`ignoring "${label}" — command must be a non-empty string`);
      continue;
    }
    const command = row.command.trim();
    // A newline would submit a second line nobody reviewed; the row is refused, never sanitised.
    if (hasControlChar(command) || hasControlChar(label)) {
      warn(`ignoring "${label}" — a control character cannot be typed verbatim`);
      continue;
    }
    const parsed: Account = { label, command };
    const prev = at.get(label);
    if (prev !== undefined) {
      warn(`"${label}" redefined — the later row wins`);
      out[prev] = parsed;
      continue;
    }
    at.set(label, out.length);
    out.push(parsed);
  }
  return out;
}

function defaultWarn(message: string): void {
  console.warn(`[accounts] ${message}`);
}

export function createOperatorAccounts(
  path: string,
  io: OperatorFileIo = diskIo,
  warn = defaultWarn,
): () => Promise<Account[]> {
  return createOperatorFileReader(path, validateOperatorAccounts, io, warn);
}
