// Who reads the two inputs of a pane's description, and how often. The same shape as
// bridge/cache/tracker.ts, whose header argues every choice below; only the differences are stated.
//
//   • OUT OF BAND. `localSnapshot` is synchronous, so the disk reads run on the state engine's poll
//     and the snapshot reads this memo, through {@link DescriptionTracker.describe}.
//   • A FLOOR PER SESSION (5 s), then a `stat` before any read. A journal tail (128 KB, the cache
//     probe's window, through `probeTail`) is read only when the log's size or mtime moved; a recap
//     file only when its own did.
//   • A FAILED READ KEEPS THE LAST READING. A missing recap file is not a failure: it means no recap.
//   • KEYED BY THE HARNESS SESSION ID, reaped only when the pane leaves ITS session's list.
//
// The status is NOT memoised. `describe` is handed the pane as it is now, so a pane that blocks shows
// the blocked sentence on the very next snapshot, without waiting for the floor.
//
// Only file-backed journals are tailed (claude, codex, pi): `probeTail` reads a path, and the
// database-backed adapters (opencode, hermes) resolve to something that is not one log file. Only a
// Claude pane has a recap file. NOTHING IS PERSISTED.

import { probeTail, type ProbeTail } from "../journal/cache-probe.ts";
import { DEFAULT_RECAP_DIR, readRecap, statRecap } from "../journal/recap.ts";
import { adapterFor } from "../journal/registry.ts";
import type { AgentSessionRef, JournalAdapter, TranscriptSource } from "../journal/types.ts";
import { journalAgentOf, type AgentView } from "../types.ts";
import { describePane, journalFacts, type JournalFacts, type PaneDescription, type Recap } from "./resolve.ts";

export const DEFAULT_DESCRIPTION_FLOOR_MS = 5000;

/**
 * The one wider read, taken only when the 128 KB tail holds no prompt AND no earlier read found one.
 * A busy Claude turn writes far more than 128 KB of tool output after the prompt that started it
 * (measured 2026-09-24: 540 KB on a live session), so a fresh bridge would otherwise show nothing for
 * every working pane until the operator typed again.
 */
export const WIDE_TAIL_BYTES = 4 * 1024 * 1024;

/** The harnesses whose journal is one log file a tail read can open. */
export const TAILED_AGENTS: ReadonlySet<string> = new Set(["claude", "codex", "pi"]);

export interface DescriptionTrackerOptions {
  floorMs?: number;
  /** Where the recap plugin writes. A containment root, never a request input. */
  recapDir?: string;
  /** The tail read, injectable so a test counts reads instead of opening files. */
  tail?: (source: TranscriptSource, ref: AgentSessionRef, bytes?: number) => Promise<ProbeTail | null>;
}

interface Seen {
  size: number;
  mtimeMs: number;
}

interface Entry {
  session: string | undefined;
  paneId: string;
  lastProbedAt: number;
  journalSeen?: Seen;
  facts?: JournalFacts;
  recapSeen?: Seen;
  recap?: Recap;
}

export class DescriptionTracker {
  private readonly bySession = new Map<string, Entry>();

  private readonly floorMs: number;

  private readonly recapDir: string;

  private readonly tail: NonNullable<DescriptionTrackerOptions["tail"]>;

  constructor(
    private readonly registry: Record<string, JournalAdapter>,
    private readonly now: () => number,
    options: DescriptionTrackerOptions = {},
  ) {
    this.floorMs = options.floorMs ?? DEFAULT_DESCRIPTION_FLOOR_MS;
    this.recapDir = options.recapDir ?? DEFAULT_RECAP_DIR;
    this.tail = options.tail ?? ((source, ref, bytes) => probeTail(source, ref, bytes));
  }

  /**
   * The description for this pane as it is now, or undefined. A synchronous map read.
   * `blockedAt` stamps the blocked sentence; the activity ledger's transition time is the right one.
   */
  describe(pane: AgentView, blockedAt?: number): PaneDescription | undefined {
    const key = pane.agentSession?.value;
    const entry = key === undefined ? undefined : this.bySession.get(key);
    return describePane({
      status: pane.status,
      recap: entry?.recap,
      facts: entry?.facts,
      now: blockedAt ?? entry?.lastProbedAt ?? this.now(),
    });
  }

  /** Walk the panes and bring their readings up to date. NEVER THROWS. */
  async refresh(panes: readonly AgentView[], scope: { session?: string } = {}): Promise<void> {
    const at = this.now();
    const session = scope.session;
    const named = new Map<string, string | undefined>();
    for (const pane of panes) {
      const ref = pane.agentSession;
      named.set(pane.paneId, ref?.value);
      if (ref === undefined) continue;
      const harness = journalAgentOf(pane);
      const adapter = TAILED_AGENTS.has(harness) ? adapterFor(this.registry, harness) : undefined;
      const wantsRecap = harness === "claude" && ref.kind === "id";
      if (adapter === undefined && !wantsRecap) continue;
      const previous = this.bySession.get(ref.value);
      const owner = { session, paneId: pane.paneId };
      if (previous !== undefined && at - previous.lastProbedAt < this.floorMs) {
        this.bySession.set(ref.value, { ...previous, ...owner });
        continue;
      }
      const next: Entry = { ...previous, ...owner, lastProbedAt: at };
      if (adapter !== undefined) await this.lookJournal(adapter, ref, next);
      if (wantsRecap) await this.lookRecap(ref.value, next);
      this.bySession.set(ref.value, next);
    }
    for (const [key, entry] of this.bySession) {
      if (entry.session === session && departed(named, key, entry.paneId)) this.bySession.delete(key);
    }
  }

  private async lookJournal(adapter: JournalAdapter, ref: AgentSessionRef, entry: Entry): Promise<void> {
    let seen: Seen | null;
    try {
      const path = await adapter.source.resolve(ref);
      seen = path === null ? null : await adapter.source.stat(path);
    } catch {
      seen = null;
    }
    if (seen === null) return;
    if (entry.journalSeen?.size === seen.size && entry.journalSeen.mtimeMs === seen.mtimeMs) return;
    const tail = await this.tail(adapter.source, ref);
    if (tail === null) return;
    try {
      let facts = journalFacts(adapter.parse(tail.lines.join("\n")));
      // A tail with no prompt means the newest prompt is older than the window, so it is the one an
      // earlier read already found. Only when none was ever found is the wider window worth paying.
      const kept = entry.facts?.prompt;
      if (facts.prompt === undefined && kept !== undefined) facts = { ...facts, prompt: kept };
      if (facts.prompt === undefined) {
        const wide = await this.tail(adapter.source, ref, WIDE_TAIL_BYTES);
        const prompt = wide === null ? undefined : journalFacts(adapter.parse(wide.lines.join("\n"))).prompt;
        if (prompt !== undefined) facts = { ...facts, prompt };
      }
      entry.facts = facts;
      entry.journalSeen = seen;
    } catch {
      // A grammar that threw on a foreign line: keep the last facts, retry at the next floor.
    }
  }

  private async lookRecap(sessionId: string, entry: Entry): Promise<void> {
    let st;
    try {
      st = await statRecap(this.recapDir, sessionId);
    } catch {
      st = null;
    }
    if (st === null) {
      delete entry.recap;
      delete entry.recapSeen;
      return;
    }
    if (entry.recapSeen?.size === st.size && entry.recapSeen.mtimeMs === st.mtimeMs) return;
    try {
      const recap = await readRecap(st.path);
      if (recap === undefined) delete entry.recap;
      else entry.recap = recap;
      entry.recapSeen = { size: st.size, mtimeMs: st.mtimeMs };
    } catch {
      // An I/O failure mid-read: the last reading stands and the next floor retries.
    }
  }
}

/** Has the pane this entry was read for left the session's list? Same rule as the cache tracker. */
function departed(named: Map<string, string | undefined>, key: string, paneId: string): boolean {
  if (!named.has(paneId)) return true;
  const now = named.get(paneId);
  return now !== undefined && now !== key;
}
