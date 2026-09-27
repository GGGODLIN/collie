// Deciding whether the newest reply in the agent's journal is the one on the mirror, whether the
// mirror is showing all of it, and — since the card shows the exchange rather than the reply alone —
// which turn just before that reply was the prompt it answered.
//
// WHY THIS EXISTS. A Claude pane runs on the terminal's alternate screen, which keeps no scrollback
// ring, so `pane.read` can only ever hand back the visible viewport — a reply longer than the pane is
// tall has its opening simply gone, and the only copy that still exists is the agent's own session log
// (bridge/journal/, GET /api/pane/:id/history). Reaching it used to mean leaving the pane for the
// history route. locateReply lets the pane view put the full message back in place instead —
// including WHERE the clipped rows end, so the card replaces them rather than printing them twice.
//
// This is NOT a step toward rendering the terminal from the journal, and it must not become one: the
// mirror stays the mirror (ADR 0008), and nothing here synthesises scrollback. All it answers is "is
// the start of the message on screen, and if not, is this even the message on screen".
//
// THE NORMALISATION IS THE WHOLE TRICK. Both sides describe the same prose in different notations:
// the journal holds Markdown source (`**bold**`, `- bullet`, one logical line per paragraph), while
// the mirror holds what Claude's renderer painted (emphasis turned into SGR runs, bullets possibly
// re-glyphed, an `⏺` prefix, and every paragraph hard-wrapped at the pane width with indentation on
// the continuation rows). Folding both to LETTERS AND DIGITS ONLY — dropping whitespace along with
// punctuation — collapses every one of those differences at once. Wrapping is the case that makes it
// necessary rather than merely convenient: the mirror breaks a paragraph wherever the pane width
// falls, the journal breaks it nowhere, and only deleting the spaces makes the two comparable
// (`hello\n  world` and `hello world` both fold to `helloworld`).
//
// Escapes must go BEFORE the fold: `\x1b[38;5;1m` is mostly digits, and digits survive folding, so an
// un-stripped SGR run would inject garbage into the middle of a probe. parseAnsi is the repo's one
// place that knows escape shapes — use it rather than a second regex that can drift from it.

import { parseAnsi } from "./ansi";
import { lineText, type Block } from "./blocks";
import { BOX_CROSS_GLYPH_CLASS, BOX_VERTICAL_GLYPH_CLASS } from "./rule-glyphs";
import type { TranscriptEntry } from "./types";

/**
 * How much of the reply each probe compares, in folded characters.
 *
 * Long enough that a coincidental match is not a real risk (48 letters of prose is a sentence), short
 * enough to sit inside the first and last rendered lines of a message.
 */
export const PROBE_CHARS = 48;

/** Where the newest reply sits relative to what the mirror is showing. */
export type ReplyFit =
  /** Its tail is on screen but its opening has scrolled off — the case worth surfacing. */
  | "clipped"
  /** All of it is on screen. */
  | "whole"
  /** Not the message the mirror is showing at all — see the note on {@link locateReply}. */
  | "off-screen";

/** Keep letters and digits, lose everything else. Unicode-aware, so a non-Latin reply still folds to
 *  its own content rather than to nothing. */
export function fold(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Plain text of a mirror read: the ANSI parse, reassembled. Newlines live inside the segments, so
 *  joining with "" reproduces the screen exactly — and the fold then removes them anyway. */
function plain(mirrorText: string): string {
  return parseAnsi(mirrorText)
    .map((segment) => segment.text)
    .join("");
}

const BOX_VERTICAL = new RegExp(`[${BOX_VERTICAL_GLYPH_CLASS}]`);
const BOX_VERTICALS = new RegExp(`[${BOX_VERTICAL_GLYPH_CLASS}]`, "g");
const BOX_CROSSES = new RegExp(`[${BOX_CROSS_GLYPH_CLASS}]`, "g");
// A frame row: box-drawing glyphs and spaces only.
const BOX_FRAME = /^[─-╿\s]+$/;

/**
 * The mirror's rows with every wrapped box-table row put back in SOURCE order.
 *
 * A renderer that wraps a table cell paints the row line by line across the columns, so the screen
 * reads cell 1's first line, cell 2's first line, then cell 1's second line. The journal holds each
 * cell whole. Without this, a probe that reaches into such a row misses and the reply reads as
 * off-screen. A logical row is the run of content rows between two frame rows; its cells are joined
 * column by column onto its LAST painted row, and the rows above it become empty. The row count never
 * changes, so an `endLine` found here still indexes the mirror as painted.
 *
 * The table is found by COUNT, not by `table-run.ts`'s column offsets: those are string indices, so a
 * cell holding double-width text (any CJK reply) misaligns them and no run is found. The anchor is a
 * frame row carrying a cross, as there; rows join while they are frame rows or carry that many
 * verticals (with or without outer borders), and a blank row ends the table. This only reorders the
 * text the probes compare; what the mirror draws is untouched.
 */
export function sourceOrderRows(rows: readonly string[]): string[] {
  const out = [...rows];
  const verticals = (row: string) => row.match(BOX_VERTICALS)?.length ?? 0;
  const isFrame = (row: string) => row.trim() !== "" && BOX_FRAME.test(row);
  let floor = 0;
  for (let anchor = 0; anchor < rows.length; anchor++) {
    if (anchor < floor || !isFrame(rows[anchor]!)) continue;
    const crosses = rows[anchor]!.match(BOX_CROSSES)?.length ?? 0;
    if (crosses === 0) continue;
    const member = (row: string) => isFrame(row) || [crosses, crosses + 2].includes(verticals(row));
    let start = anchor;
    while (start > floor && member(rows[start - 1]!)) start--;
    let end = anchor;
    while (end + 1 < rows.length && member(rows[end + 1]!)) end++;
    floor = end + 1;

    let group: number[] = [];
    const flush = () => {
      if (group.length > 1) {
        const cells = group.map((i) => rows[i]!.split(BOX_VERTICAL));
        const joined = cells[0]!.map((_, col) => cells.map((c) => c[col] ?? "").join(" "));
        for (const i of group) out[i] = "";
        out[group.at(-1)!] = joined.join(" ");
      }
      group = [];
    };
    for (let i = start; i <= end; i++) {
      if (isFrame(rows[i]!)) flush();
      else group.push(i);
    }
    flush();
  }
  return out;
}

/** A turn's prose — its `text` parts only. Thinking is not the reply, and a tool call is not speech. */
export function replyProse(entry: TranscriptEntry): string {
  return entry.parts
    .filter((part) => part.kind === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/** True when the bridge capped one of those parts (MAX_TEXT_CHARS), so what we hold is not the end. */
function proseTruncated(entry: TranscriptEntry): boolean {
  return entry.parts.some((part) => part.kind === "text" && part.truncated === true);
}

/** Index of the newest turn that is the agent SPEAKING, or -1. */
function newestReplyIndex(entries: TranscriptEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && entry.role === "assistant" && replyProse(entry) !== "") return i;
  }
  return -1;
}

/** The newest turn that is the agent SPEAKING — the last assistant entry carrying prose. */
export function newestReply(entries: TranscriptEntry[]): TranscriptEntry | null {
  const at = newestReplyIndex(entries);
  return at === -1 ? null : entries[at]!;
}

/** The last FINISHED exchange: what the agent said, and what was asked of it. */
export interface LatestExchange {
  /** The newest assistant turn carrying prose — the one `locateReply` is asked about. */
  reply: TranscriptEntry;
  /** The nearest prose user turn before that reply. */
  prompt: TranscriptEntry;
}

/** Pair the newest spoken reply only with the nearest prose user turn before it. */
export function newestExchange(entries: TranscriptEntry[]): LatestExchange | null {
  const at = newestReplyIndex(entries);
  if (at === -1) return null;
  for (let i = at - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && entry.role === "user" && replyProse(entry) !== "") {
      return { reply: entries[at]!, prompt: entry };
    }
  }
  return null;
}

/** Where a turn sits on the mirror, and which row it ends on when present. */
export interface ReplyPlacement {
  fit: ReplyFit;
  /** Index of the last mirror row the reply occupies; -1 when it is off-screen. */
  endLine: number;
}

const elsewhere = (fit: ReplyFit): ReplyPlacement => ({ fit, endLine: -1 });

/**
 * Locate a journal turn on the mirror.
 *
 * Two probes, and the ORDER OF THE VERDICTS matters more than either of them:
 *
 * - The **tail** probe is the identity check. The journal's newest reply is not necessarily the one
 *   on screen — the log lags a message that is still streaming, the operator may have frozen the
 *   mirror by scrolling, and a >20 000-character part reaches us clamped so its real ending never
 *   arrives. When the tail is missing we answer `off-screen` and the caller shows NOTHING. Presenting
 *   an older message as "the reply you are looking at" is the one failure this must not have.
 * - The **head** probe then answers whether its opening is still on the screen. Short replies use
 *   their entire text as the probe, so they can be wrapped consistently too.
 *
 * `endLine` exists so the caller can REPLACE those rows with the full message rather than print it
 * twice. Folding erases the row boundaries, so the row that the reply ends on is recovered by keeping
 * each row's cumulative folded length and finding the first that reaches the tail probe's end.
 */
export function locateReply(mirrorText: string, entry: TranscriptEntry): ReplyPlacement {
  const prose = replyProse(entry);
  if (fold(prose) === "" || proseTruncated(entry)) return elsewhere("off-screen");

  const rows = sourceOrderRows(plain(mirrorText).split("\n"));
  // Folding each row and concatenating is the same string as folding the whole screen — the fold
  // drops the separators either way — so these offsets index into one folded mirror.
  const rowEnds: number[] = [];
  let mirror = "";
  for (const row of rows) {
    mirror += fold(row);
    rowEnds.push(mirror.length);
  }

  // Both spellings are this same reply, so either one found is still the identity check passing.
  for (const reply of new Set([fold(linkTextOnly(prose)), fold(prose)])) {
    const probeLength = Math.min(PROBE_CHARS, reply.length);
    const tail = reply.slice(-probeLength);
    const at = mirror.indexOf(tail);
    if (at === -1) continue;

    const end = at + tail.length;
    const endLine = rowEnds.findIndex((rowEnd) => rowEnd >= end);
    return {
      fit: mirror.includes(reply.slice(0, probeLength)) ? "whole" : "clipped",
      endLine: endLine === -1 ? rows.length - 1 : endLine,
    };
  }
  return elsewhere("off-screen");
}

// `[label](target)` and `![alt](target)`, with an optional `"title"`.
const MARKDOWN_LINK = /!?\[([^\]]*)\]\(\s*<?[^)\s>]*>?(?:\s+"[^"]*")?\s*\)/g;

/**
 * The reply with every inline Markdown link reduced to its label. Claude paints a link as its label
 * alone where the terminal takes hyperlinks (Herdr's grid, 2026-09-27), so the target the journal
 * holds is nowhere on screen; a renderer that prints the target too is still matched by the raw
 * spelling, which {@link locateReply} tries second.
 */
function linkTextOnly(prose: string): string {
  return prose.replace(MARKDOWN_LINK, "$1");
}

/**
 * The part of the mirror whose stillness means "a message finished": every block's rows, which is
 * the screen minus the input box and statusline each harness's buildBlocks already peeled off.
 *
 * The latest-reply read waits for the mirror to hold still (hooks/use-latest-reply.ts). A statusline
 * that redraws every second (a clock, CPU, a cache countdown) never holds still, so judged on the raw
 * screen the read fired once when the pane opened and never again: a reply that finished while you
 * watched never became a card. The card's identity check still runs on the full screen.
 */
export function settleText(blocks: readonly Block[]): string {
  return blocks.flatMap((block) => block.lines.map(lineText)).join("\n");
}

