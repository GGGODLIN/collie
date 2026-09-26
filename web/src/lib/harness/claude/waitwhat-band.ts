// Fork-only (FORK.md → Personal changes): the band the operator's own Claude Code mod,
// cc-mod-waitwhat, draws above the input box. Its buttons are text in the mirror, so a tap does
// nothing, and the phone already has both halves of it — Plain / Lost in the retell sheet (ADR 0074)
// and the recap line as the pane description — so the view drops the band instead of showing a
// second, dead copy.
//
// Render-only and CONSERVATIVE, like stripChrome: it runs on stripChrome's output, so it only fires
// when the input box was confidently peeled off and the band is the last thing left above it; every
// row from the header down must be one the mod draws, or nothing is removed. A wrapped error line
// or a band shape this file does not know stays on the mirror.

import { isBlank, lineText, type StyledLine } from "../../blocks";

const HEADER_RE = /^wait what \[ 白話 \] \[ 跟丟了 \](?: \[ 清除 \])?(?:\s+\[[-+]\])?$/;
const HOST_CHOICE_RE = /^\[ Orca \] \[ Herdr \] \[ 取消 \]$/;

function isBandRow(text: string): boolean {
  return (
    isBlank(text) ||
    text.startsWith("recap · ") ||
    text.startsWith("── ") ||
    text.startsWith("退回原因：") ||
    /^[╭│╰]/.test(text) ||
    HOST_CHOICE_RE.test(text)
  );
}

/** Drop a trailing wait-what band (and the blank run above it). Returns `lines` unchanged, same
 *  reference, when the tail is not exactly that band. */
export function stripWaitWhatBand(lines: StyledLine[]): StyledLine[] {
  const texts = lines.map((l) => lineText(l).trim());
  let header = texts.length - 1;
  while (header >= 0 && !HEADER_RE.test(texts[header]!)) {
    if (!isBandRow(texts[header]!)) return lines;
    header--;
  }
  if (header < 0) return lines;

  let above = header;
  while (above > 0 && isBlank(texts[above - 1]!)) above--;
  return lines.slice(0, above);
}
