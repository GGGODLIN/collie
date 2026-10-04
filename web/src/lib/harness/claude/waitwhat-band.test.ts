import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { claudeBuildBlocks } from "./index";
import { stripWaitWhatBand } from "./waitwhat-band";

import { waitWhatBox as box, waitWhatHeader as header, waitWhatIdleRows, waitWhatRecapRows } from "@/test/fork-regression-data";
const buffer = (rows: string[]): StyledLine[] => splitLines(parseAnsi(rows.join("\n")));
const texts = (lines: StyledLine[]): string[] => lines.map((l) => lineText(l));
const mirror = (rows: string[]): string[] => {
  const blocks = claudeBuildBlocks(buffer(rows));
  expect(blocks).toHaveLength(1);
  return texts(blocks[0]!.lines);
};

describe("stripWaitWhatBand", () => {
  it("drops the idle band above the input box", () => {
    expect(mirror(waitWhatIdleRows)).toEqual(["● Done."]);
  });

  it("drops the recap line and a finished retelling with it", () => {
    const rows = waitWhatRecapRows;
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
