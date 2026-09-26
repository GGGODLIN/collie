import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { claudeBuildBlocks } from "./index";
import { stripWaitWhatBand } from "./waitwhat-band";

const rule = "─".repeat(60);
const buffer = (rows: string[]): StyledLine[] => splitLines(parseAnsi(rows.join("\n")));
const texts = (lines: StyledLine[]): string[] => lines.map((l) => lineText(l));
const mirror = (rows: string[]): string[] => {
  const blocks = claudeBuildBlocks(buffer(rows));
  expect(blocks).toHaveLength(1);
  return texts(blocks[0]!.lines);
};

// Shape read off a live Herdr pane on 2026-09-26: band header, blank, then the input box.
const box = ["", rule, "❯ ", rule, "   ◆ Opus 5.5 (high)  ⎇ main"];
const header = "wait what [ 白話 ] [ 跟丟了 ]                                     [-]";

describe("stripWaitWhatBand", () => {
  it("drops the idle band above the input box", () => {
    expect(mirror(["● Done.", "", header, ...box])).toEqual(["● Done."]);
  });

  it("drops the recap line and a finished retelling with it", () => {
    const rows = [
      "● Done.",
      "",
      "wait what [ 白話 ] [ 跟丟了 ] [ 清除 ]",
      "recap · 藏 band → 跑測試",
      "── 白話 · 往回 1 turn  (送出 201 字 → http:gemini · 6.5s)",
      "   退回原因：timeout",
      "╭────────────╮",
      "│ 重講內容   │",
      "╰────────────╯",
      ...box,
    ];
    expect(mirror(rows)).toEqual(["● Done."]);
  });

  it("drops the host choice rows", () => {
    const rows = ["● Done.", header, "── 白話 · 同時有 Orca 與 Herdr 身分，請選擇宿主（未選不執行）", "[ Orca ] [ Herdr ] [ 取消 ]", ...box];
    expect(mirror(rows)).toEqual(["● Done."]);
  });

  it("keeps a band holding a row the mod does not draw", () => {
    const rows = ["● Done.", header, "── 白話 · 失敗：a long error that", "wrapped onto a second row", ...box];
    expect(mirror(rows)).toContain("wrapped onto a second row");
    expect(mirror(rows)).toContain(header);
  });

  it("keeps the header quoted in the transcript when output follows it", () => {
    const rows = ["  wait what [ 白話 ] [ 跟丟了 ]", "● Next reply.", ...box];
    expect(mirror(rows)).toEqual(["  wait what [ 白話 ] [ 跟丟了 ]", "● Next reply."]);
  });

  it("returns the same reference when there is no band", () => {
    const lines = buffer(["● Done.", "more"]);
    expect(stripWaitWhatBand(lines)).toBe(lines);
  });
});
