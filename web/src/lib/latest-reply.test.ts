import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitLines } from "./blocks";
import { buildBlocks } from "./harness";
import { parseAnsi } from "./ansi";
import { fold, locateReply, newestExchange, newestReply, replyProse, settleText, sourceOrderRows } from "./latest-reply";
import type { TranscriptEntry, TranscriptPart } from "./types";
import { wrappedTableAfter, wrappedTablePainted, wrappedTableSource } from "../test/sweep-loop-reply-data";

// The predicates behind "the mirror is only showing the end of this reply". The cases that matter are
// the ones where the two sides of the comparison are written differently — Markdown source against a
// rendered, hard-wrapped, SGR-coloured screen — and the one where they are different MESSAGES.

function turn(
  role: TranscriptEntry["role"],
  text: string,
  extra: { uuid?: string; truncated?: boolean } = {},
): TranscriptEntry {
  const parts: TranscriptPart[] = [
    extra.truncated ? { kind: "text", text, truncated: true } : { kind: "text", text },
  ];
  return {
    uuid: extra.uuid ?? `${role}-${text.slice(0, 8)}`,
    ts: "2026-08-28T10:00:00.000Z",
    role,
    parts,
  };
}

// A reply comfortably longer than two probes, with Markdown in it.
const REPLY = [
  "Short answer: **approve-only**. The author knows when they want it to land; your job was the",
  "approval. Enabling auto-merge makes you the actor for the merge itself, which is a materially",
  "bigger claim than \"this looks fine to me\".",
  "",
  "- `deployment_tools` gates production, so an automated approval there is a different risk class.",
  "- A fast manual approval keeps your name on something you actually saw.",
].join("\n");

/** Wrap text the way a terminal does — at word boundaries, with continuation rows indented. */
function hardWrap(text: string, cols: number): string {
  return text
    .split("\n")
    .flatMap((line) => {
      const rows: string[] = [];
      let row = "";
      for (const word of line.split(" ")) {
        const candidate = row === "" ? word : `${row} ${word}`;
        if (candidate.length > cols && row !== "") {
          rows.push(row);
          row = word;
        } else {
          row = candidate;
        }
      }
      rows.push(row);
      return rows.map((r, i) => (i === 0 ? r : `  ${r}`));
    })
    .join("\n");
}

/** What Claude paints: no Markdown markers, emphasis as SGR, an ⏺ lead, hard-wrapped. */
function rendered(text: string, cols = 40): string {
  const painted = text.replace(/\*\*(.+?)\*\*/g, "\x1b[1m$1\x1b[0m").replace(/`/g, "");
  return `⏺ ${hardWrap(painted, cols)}`;
}

describe("fold", () => {
  it("erases every difference between Markdown source and a wrapped, coloured render", () => {
    // The SGR-painted form "\x1b[1mbold\x1b[0m text" reaches fold with its escapes already stripped.
    expect(fold("**bold** text")).toBe(fold("bold text"));
    expect(fold("hello world")).toBe(fold("hello\n  world"));
    expect(fold("- a bullet")).toBe(fold("  • a bullet"));
  });

  it("keeps non-Latin content rather than folding it away", () => {
    expect(fold("こんにちは、世界")).toBe("こんにちは世界");
  });
});

describe("newestReply", () => {
  const entries: TranscriptEntry[] = [
    turn("user", "what should I do?"),
    turn("assistant", "first thought"),
    turn("assistant", "second thought"),
  ];

  it("picks the last assistant turn carrying prose", () => {
    expect(replyProse(newestReply(entries)!)).toBe("second thought");
  });

  it("skips a trailing turn that is only a tool call", () => {
    const toolOnly: TranscriptEntry = {
      uuid: "tool",
      ts: "",
      role: "assistant",
      parts: [{ kind: "tool", name: "Bash", summary: "ls" }],
    };
    expect(replyProse(newestReply([...entries, toolOnly])!)).toBe("second thought");
  });

  it("returns null when the agent has not spoken", () => {
    expect(newestReply([turn("user", "hello")])).toBeNull();
  });

  it("walks PAST a turn the agent rewound away from", () => {
    // pi keeps every branch in one log, so the newest turn in the array is not always the newest turn
    // in the conversation. Skipping rather than stopping is the point: the reply that IS current sits
    // further back.
    const rewound: TranscriptEntry = { ...turn("assistant", "from the abandoned path"), abandoned: true };
    expect(replyProse(newestReply([...entries, rewound])!)).toBe("second thought");
  });
});

describe("newestExchange", () => {
  const ask = (text: string, uuid = `u-${text.slice(0, 6)}`) => turn("user", text, { uuid });
  const say = (text: string, uuid = `a-${text.slice(0, 6)}`) => turn("assistant", text, { uuid });

  it("pairs the newest spoken reply with the prompt above it", () => {
    const exchange = newestExchange([ask("first q"), say("first a"), ask("second q"), say("second a")]);
    expect(replyProse(exchange!.reply)).toBe("second a");
    expect(replyProse(exchange!.prompt!)).toBe("second q");
  });

  it("ignores a prompt written after the reply", () => {
    const exchange = newestExchange([ask("the q"), say("the a"), ask("the NEXT q")]);
    expect(replyProse(exchange!.reply)).toBe("the a");
    expect(replyProse(exchange!.prompt!)).toBe("the q");
  });

  it("returns null instead of a reply-only exchange when the prompt is absent", () => {
    expect(newestExchange([say("orphan answer")])).toBeNull();
  });
});

describe("locateReply", () => {
  const fitOf = (mirror: string, entry: TranscriptEntry) => locateReply(mirror, entry).fit;
  const reply = turn("assistant", REPLY);

  it("calls it clipped when the tail is painted but the opening has scrolled off", () => {
    const screen = rendered(REPLY).split("\n").slice(4).join("\n");
    expect(fitOf(screen, reply)).toBe("clipped");
  });

  it("calls it whole when the whole message is on screen, markers and colour notwithstanding", () => {
    expect(fitOf(rendered(REPLY), reply)).toBe("whole");
  });

  it("survives a pane narrow enough to wrap every line several times", () => {
    const screen = rendered(REPLY, 18).split("\n").slice(6).join("\n");
    expect(fitOf(screen, reply)).toBe("clipped");
  });

  // The identity check: the journal's newest reply is not automatically the one being displayed.
  it("calls it off-screen when the mirror is showing some other message", () => {
    expect(fitOf(rendered("a completely different answer about something else"), reply)).toBe(
      "off-screen",
    );
  });

  it("calls it off-screen when the mirror has moved on past this reply entirely", () => {
    const screen = `${rendered(REPLY).split("\n").slice(0, 3).join("\n")}\n⏺ and then a new message`;
    expect(fitOf(screen, reply)).toBe("off-screen");
  });

  // A clamped part's real ending never reaches us, so the tail probe could never match — say so
  // explicitly rather than leaving it to fall out of the probe.
  it("calls it off-screen when the bridge clamped the part", () => {
    expect(fitOf(rendered(REPLY), turn("assistant", REPLY, { truncated: true }))).toBe(
      "off-screen",
    );
  });

  it("locates a short reply instead of assuming it is on screen", () => {
    const short = turn("assistant", "short answer");
    expect(fitOf(rendered("short answer"), short)).toBe("whole");
    expect(fitOf("nothing of the sort is on this screen", short)).toBe("off-screen");
  });

  // SGR parameters are digits, and digits survive the fold — an unstripped escape would corrupt the
  // probe it landed in. parseAnsi runs first precisely so it cannot.
  it("does not let SGR parameters leak into the comparison", () => {
    const coloured = `\x1b[38;5;213m${REPLY}\x1b[0m`;
    expect(fitOf(coloured, reply)).toBe("whole");
  });
});

// endLine is what lets the caller REPLACE the clipped rows instead of printing the message twice, so
// it has to name the row the reply actually finishes on — not the screen's last row.
describe("locateReply — where the reply ends", () => {
  const reply = turn("assistant", REPLY);

  it("names the last row of the reply, with the terminal's own tail below it", () => {
    const painted = rendered(REPLY).split("\n").slice(4); // clipped: the opening is gone
    const after = ["", "⏺ Bash(git log --oneline)", "  ⎿ abc1234 fix"];
    const { fit, endLine } = locateReply([...painted, ...after].join("\n"), reply);

    expect(fit).toBe("clipped");
    // The reply's own rows are 0..endLine, and everything the agent did afterwards survives.
    expect(endLine).toBe(painted.length - 1);
    expect([...painted, ...after].slice(endLine + 1)).toEqual(after);
  });

  it("names the final row when the reply is the last thing painted", () => {
    const painted = rendered(REPLY).split("\n").slice(4);
    const { endLine } = locateReply(painted.join("\n"), reply);
    expect(endLine).toBe(painted.length - 1);
  });

  it("reports an end row for a whole reply and none when it is off-screen", () => {
    const painted = rendered(REPLY).split("\n");
    expect(locateReply(painted.join("\n"), reply).endLine).toBe(painted.length - 1);
    expect(locateReply("some other screen entirely", reply).endLine).toBe(-1);
  });
});

// A real Claude pane, 2026-09-27: the reply ended in a Markdown table whose cells Claude wrapped. The
// renderer prints a wrapped row line by line ACROSS the columns, so the screen reads a row's cells in
// a different order than the source does, and a tail probe that reached into the table missed.
describe("locateReply — a reply that ends in a wrapped table", () => {
  const source = wrappedTableSource;
  const painted = wrappedTablePainted;
  const after = wrappedTableAfter;

  it("still finds the reply, and still ends it on its last row", () => {
    const { fit, endLine } = locateReply([...painted, ...after].join("\n"), turn("assistant", source));
    expect(fit).toBe("clipped");
    expect(endLine).toBe(painted.length - 1);
  });

  it("leaves a screen with no crossed frame row exactly as painted", () => {
    const inputBox = ["╭────────────────╮", "│ > type here    │", "│   second line  │", "╰────────────────╯"];
    const prose = ["⏺ A reply with a │ pipe-ish glyph", "  and a second │ line"];
    expect(sourceOrderRows([...prose, ...inputBox])).toEqual([...prose, ...inputBox]);
  });

  // Grok 1.0.46 paints a scrollbar cell at the right edge of every row once a reply outgrows the
  // pane, frame rows included (live capture, 2026-10-08). A frame row ending in that cell must still
  // read as a frame, or the table's last row stays interleaved and the reply reads as off-screen.
  it("still finds a Grok reply whose table rows end in the scrollbar cell", () => {
    const grokSource = [
      "一、建議怎麼配置",
      "",
      "| 用水位置 | 建議設備 |",
      "|---|---|",
      "| 全家人每天喝水與煮開水都集中在飲用水這一處，濾心週期也必須跟得上實際用量。 | 飲用水建議採用逆滲透或中空絲膜系統，並設定半年更換濾心的提醒以免過濾效果衰退。 |",
    ].join("\n");
    const rail = "      █";
    const grokPainted = [
      "     一、建議怎麼配置",
      "",
      "     ┌──────────────────────┬────────────────────────┐",
      "     │ 用水位置             │ 建議設備               │",
      "     ├──────────────────────┼────────────────────────┤" + rail,
      "     │ 全家人每天喝水與煮開 │ 飲用水建議採用逆滲透或 │" + rail,
      "     │ 水都集中在飲用水這一 │ 中空絲膜系統，並設定半 │" + rail,
      "     │ 處，濾心週期也必須跟 │ 年更換濾心的提醒以免過 │" + rail,
      "     │ 得上實際用量。       │ 濾效果衰退。           │" + rail,
      "     └──────────────────────┴────────────────────────┘" + rail,
    ];
    const { fit, endLine } = locateReply(grokPainted.join("\n"), turn("assistant", grokSource));
    expect(fit).toBe("whole");
    expect(endLine).toBe(8);

    // The same reply as Grok paints it while the message is highlighted: a box round the whole
    // message adds one vertical at each end of every table row (live capture, 2026-10-08).
    const boxed = grokPainted.map((row, i) => {
      const [body, tail] = row.endsWith(rail) ? [row.slice(0, -rail.length), rail] : [row, ""];
      if (i < 2) return ` │ ${body}`;
      return ` │ ${body}   │${tail}`;
    });
    boxed.push(` └${"─".repeat(60)}┘${rail}`);
    const inBox = locateReply(boxed.join("\n"), turn("assistant", grokSource));
    expect(inBox.fit).toBe("whole");
    expect(inBox.endLine).toBe(8);
  });

  // Grok prints the reply's time at the right end of its first row, or alone on the next row when the
  // first row is full (live captures, 2026-10-08). A short reply is probed whole, so the time folded
  // into its middle made every short Grok reply read as off-screen.
  it("finds a short Grok reply whose first row carries the time", () => {
    const shortSource = "早上出門先看天氣，再決定要帶多厚的外套。\n\n| 晴 | 雨 |\n| --- | --- |\n| 薄外套 | 防水外套 |";
    const table = [
      "     ┌────────┬──────────┐",
      "     │ 晴     │ 雨       │",
      "     ├────────┼──────────┤",
      "     │ 薄外套 │ 防水外套 │",
      "     └────────┴──────────┘",
    ];
    const sameRow = ["     早上出門先看天氣，再決定要帶多厚的外套。                    8:48 PM    ", "", ...table];
    expect(locateReply(sameRow.join("\n"), turn("assistant", shortSource)).fit).toBe("whole");
    const ownRow = ["     早上出門先看天氣，再決定要帶多厚的外套。", "5:13 PM", "", ...table];
    expect(locateReply(ownRow.join("\n"), turn("assistant", shortSource)).fit).toBe("whole");
    const highlighted = sameRow.map((row) => ` │ ${row} │`);
    expect(locateReply(highlighted.join("\n"), turn("assistant", shortSource)).fit).toBe("whole");
  });

  it("finds a tail that lies wholly inside the table's last row", () => {
    const tableEnd = source.slice(0, source.lastIndexOf("\n\n"));
    const { fit, endLine } = locateReply(painted.slice(0, 9).join("\n"), turn("assistant", tableEnd));
    expect(fit).toBe("clipped");
    // The last source row spans two painted rows; the reply ends on the lower one, above the frame.
    expect(endLine).toBe(7);
  });
  // The table's floor ends it. Prose under the table and the next prompt each hold one `│`, the
  // count a one-column-boundary row carries, and must stay where they were painted: joined onto the
  // prompt row, the reply's end would move onto the operator's next message.
  it("stops at the table's floor, so a line holding a vertical below it keeps its own row", () => {
    const tail = "The final printed delimiter uses the box drawing vertical separator shown here │";
    const screen = ["├───────┼─────┤", "│ Ready │ Yes │", "└───────┴─────┘", tail, "❯ 下一題：請說明 │ 與 | 的差異"];
    const reply = `${source}\n\n| State | Result |\n|---|---|\n| Ready | Yes |\n\n${tail}`;
    expect(locateReply(screen.join("\n"), turn("assistant", reply))).toEqual({ fit: "clipped", endLine: 3 });
  });

  // Painted lines of one logical row that disagree on their vertical count are not one row of this
  // table. Joining them by the first line's columns dropped the extra text, so a different ending
  // passed as this reply.
  it("leaves a row whose painted lines disagree on their columns as painted", () => {
    const screen = [
      "├────────────────┼───────────────────────────┤",
      "│ left one │ The unique ending │",
      "│ left two │ explains the intended │ final state │ ACTUAL ENDING DIFFERS │",
      "└────────────────┴───────────────────────────┘",
    ];
    const reply = `${source}\n\n| left one left two | The unique ending explains the intended final state |`;
    expect(locateReply(screen.join("\n"), turn("assistant", reply)).fit).toBe("off-screen");
  });
});

// A real Claude pane, 2026-09-27 (paths shortened): the reply's last table linked each row to a file.
// Claude painted only the link text, so the URL the journal holds was nowhere on screen and a tail
// probe that reached into it missed.
describe("locateReply — a reply whose tail holds Markdown links", () => {
  const source = [
    "完整證據與未驗證範圍都在下表的連結裡，你可以逐項打開核對。這段是為了讓回覆夠長。",
    "",
    "| 選項 | 處置 | 來源 |",
    "|---|---|---|",
    "| **a．推薦** | 只修已重現的目錄解析、補回歸測試 | [解析重現與延輪日期](file:///tmp/review-evidence/2026-09-27.md) |",
    "| b | 不修改，原樣延輪；保留已知缺陷 | [現行函式的失敗重現](file:///tmp/review-evidence/2026-09-27.md) |",
    "",
    "🔎 self-verify: COMPLIANT",
  ].join("\n");
  const painted = [
    "  ┌─────────┬──────────────────────────────────┬────────────────────┐",
    "  │  選項   │               處置               │        來源        │",
    "  ├─────────┼──────────────────────────────────┼────────────────────┤",
    "  │ a．推薦 │ 只修已重現的目錄解析、補回歸測試 │ 解析重現與延輪日期 │",
    "  ├─────────┼──────────────────────────────────┼────────────────────┤",
    "  │ b       │ 不修改，原樣延輪；保留已知缺陷   │ 現行函式的失敗重現 │",
    "  └─────────┴──────────────────────────────────┴────────────────────┘",
    "",
    "  🔎 self-verify: COMPLIANT",
  ];

  it("finds the reply when only the link text was painted", () => {
    const { fit, endLine } = locateReply(painted.join("\n"), turn("assistant", source));
    expect(fit).toBe("clipped");
    expect(endLine).toBe(painted.length - 1);
  });

  it("still finds it when the renderer printed the URL as well", () => {
    const withUrls = painted.map((row) => row.replace("失敗重現 │", "失敗重現 (file:///tmp/review-evidence/2026-09-27.md) │"));
    const tailOnly = "[現行函式的失敗重現](file:///tmp/review-evidence/2026-09-27.md) |\n\n🔎 self-verify: COMPLIANT";
    expect(locateReply(withUrls.join("\n"), turn("assistant", `開頭不在畫面上的一段很長的前文。\n${tailOnly}`)).fit).toBe("clipped");
  });
});

// More source that Claude does not paint as written. Each case pairs the journal's Markdown with the
// rows Claude drew for it, and each would have missed with the raw text alone.
describe("locateReply — source spelled differently on screen", () => {
  const lead = "開頭已經捲出畫面的一段很長的前文，只是為了讓這則回覆被判定成 clipped，也讓整則回覆長過短回覆的門檻。";

  // A real Claude pane, 2026-09-27: the fence's info string is not painted.
  it("a code block's language tag", () => {
    const source = `${lead}\n\n- 沒變成卡片：證實這個 bug 存在，我照上面的計畫修。\n- 有變成卡片：代表 Claude 其實有畫出語言標記，這一項就不用修。\n\n\`\`\`bash\necho "這個區塊的語言標記是 bash"\n\`\`\``;
    const painted = [
      "  - 沒變成卡片：證實這個 bug 存在，我照上面的計畫修。",
      "  - 有變成卡片：代表 Claude 其實有畫出語言標記，這一項就不用修。",
      "",
      '  echo "這個區塊的語言標記是 bash"',
    ];
    expect(locateReply(painted.join("\n"), turn("assistant", source))).toEqual({ fit: "clipped", endLine: 3 });
  });

  it("an HTML entity and a tag", () => {
    const source = `${lead}\n\n前面再多墊一行夠長的文字，確保比對範圍不會伸進畫面外的前文。\n這一句只是為了讓結尾比對用的四十八個字全部落在畫面上，所以先寫長一點再收尾：A &amp; B<br>C`;
    const painted = ["  前面再多墊一行夠長的文字，確保比對範圍不會伸進畫面外的前文。", "  這一句只是為了讓結尾比對用的四十八個字全部落在畫面上，所以先寫長一點再收尾：A & BC"];
    expect(locateReply(painted.join("\n"), turn("assistant", source)).fit).toBe("clipped");
  });

  it("never throws on an entity outside Unicode, and leaves it as written", () => {
    const tail = "這一句只是為了讓結尾比對用的四十八個字全部落在畫面上，所以先寫長一點再收尾：&#x110000; 和 &#1114112; 都照原樣";
    const painted = [`  ${tail}`];
    for (const text of [`${lead}\n\n${tail}`]) {
      expect(() => locateReply(painted.join("\n"), turn("assistant", text))).not.toThrow();
      expect(locateReply(painted.join("\n"), turn("assistant", text)).fit).toBe("clipped");
    }
  });

  it("keeps code spans literal while it reduces the link beside them", () => {
    const source = `${lead}\n\n這一句只是為了讓結尾比對用的四十八個字全部落在畫面上，所以先寫長一點再收尾：分工寫在 [分工說明](file:///tmp/split.md)，路徑是 \`<repo>/wt\``;
    const painted = ["  這一句只是為了讓結尾比對用的四十八個字全部落在畫面上，所以先寫長一點再收尾：分工寫在 分工說明，路徑是 <repo>/wt"];
    expect(locateReply(painted.join("\n"), turn("assistant", source)).fit).toBe("clipped");
  });
  // An autolink is printed as its address. Read as a tag and dropped, a different address on screen
  // passed as this reply, and the right one ended the reply a row too early.
  it("keeps an autolink's address, so a different one on screen is not this reply", () => {
    const visible =
      "Review the implementation carefully and compare the handling of all supported spellings before opening the documentation.";
    const source = `${lead}\n\n${visible}\n<https://example.com/new-release>`;
    expect(locateReply(`${visible}\nhttps://example.com/old-release`, turn("assistant", source)).fit).toBe("off-screen");
    expect(locateReply(`${visible}\nhttps://example.com/new-release`, turn("assistant", source))).toEqual({
      fit: "clipped",
      endLine: 1,
    });
  });

  // A three-backtick block shown inside a four-backtick one is code, and so is everything in it: the
  // inner fence must not close the outer one and expose its body to the tag rule.
  it("keeps a fence shown inside a longer fence as code", () => {
    const code = "Please print this entire code example literally and retain each part of the following file path: <private>/config";
    const source = [lead, "````markdown", "```sh", code, "```", "````"].join("\n");
    const without = ["```sh", code.replace("<private>", ""), "```"].join("\n");
    expect(locateReply(without, turn("assistant", source)).fit).toBe("off-screen");
    expect(locateReply(["```sh", code, "```"].join("\n"), turn("assistant", source)).fit).toBe("clipped");
  });

  it("reduces a link whose label is a code span to that label", () => {
    const visible =
      "Review the implementation carefully and compare the handling of all supported spellings before opening the documentation.";
    const source = `${lead}\n\n${visible} [\`latest-reply.ts\`](https://example.com/src/latest-reply.ts)`;
    expect(locateReply(`${visible} latest-reply.ts`, turn("assistant", source)).fit).toBe("clipped");
  });

  // The short-reply rule judged the raw text. A spelling that dropped a long target can fall under two
  // probes, and then a common closing line, or nothing at all, would pass as the reply.
  it("does not let a painted spelling shorter than two probes decide", () => {
    const label = "Report for the newest release: All tasks completed successfully and all output files are ready";
    const target = `https://example.com/${"a".repeat(100)}`;
    const common = "All tasks completed successfully and all output files are ready";
    expect(locateReply(common, turn("assistant", `[${label}](${target})`)).fit).toBe("off-screen");
    expect(locateReply("", turn("assistant", `[ ](${target})`)).fit).toBe("off-screen");
  });

  it("decodes a numeric entity rather than dropping it", () => {
    const tail = "這一句只是為了讓結尾比對用的四十八個字全部落在畫面上，所以先寫長一點再收尾：&#65;&#x4E2D;BC";
    const pad = "前面再多墊一行夠長的文字，確保比對範圍不會伸進畫面外的前文。";
    const painted = [`  ${pad}`, "  這一句只是為了讓結尾比對用的四十八個字全部落在畫面上，所以先寫長一點再收尾：A中BC"];
    expect(locateReply(painted.join("\n"), turn("assistant", `${lead}\n\n${pad}\n${tail}`)).fit).toBe("clipped");
  });

  // The raw spelling is tried second, so a painted spelling that wrongly dropped the out-of-range
  // references would be rescued by it in the case above. Here the tail also holds a link the screen
  // paints as its label, so only a painted spelling that keeps the references as written matches.
  it("keeps an out-of-range entity as written where only the painted spelling can match", () => {
    const tail = `${"只供比對的尾段".repeat(8)}[文件](https://example.com/hidden) &#x110000; 和 &#1114112; END`;
    const screen = tail.replace("[文件](https://example.com/hidden)", "文件");
    expect(locateReply(screen, turn("assistant", `${lead}\n\n${tail}`)).fit).toBe("clipped");
  });
});

// A real Claude capture: one reply, the input box, and a statusline row under it.
describe("settleText — what counts as the mirror holding still", () => {
  const screen = readFileSync(join(import.meta.dirname, "..", "fixtures", "panes", "claude--done.txt"), "utf8");
  const settle = (text: string) => settleText(buildBlocks(splitLines(parseAnsi(text)), { agent: "claude" }));

  it("ignores a statusline that redrew, so a quiet pane still counts as settled", () => {
    expect(screen).toContain("32.7k tokens");
    expect(settle(screen.replace("32.7k tokens", "33.1k tokens").replace("ctx:3%", "ctx:4%"))).toBe(settle(screen));
  });

  it("still moves when the reply itself changes", () => {
    expect(screen).toContain("containing the single word ");
    expect(settle(screen.replace("containing the single word ", "holding the single word "))).not.toBe(settle(screen));
  });
});

// Real Grok 1.0.46 panes (2026-10-08, Herdr 0.9.0, 130 columns), each with the reply its own journal
// held. Each failed the identity check before its fix, so a terminal-view operator got no card.
describe("locateReply — real Grok replies", () => {
  const pane = (name: string) =>
    readFileSync(join(import.meta.dirname, "..", "fixtures", "panes", `${name}.txt`), "utf8");
  const water = [
    "家庭用水先分清楚喝、洗、沖三種用途，再依水壓與水質決定要不要過濾或軟水。設備不必一次買齊，先處理每天入口的水與最耗水的淋浴，其餘位置再依使用頻率補上。",
    "",
    "一、建議怎麼配置",
    "",
    "| 用水位置 | 建議設備 |",
    "| --- | --- |",
    "| 廚房是全家備餐與清洗餐具最頻繁的位置，日常洗滌與飲用出水必須分開，才不會把清潔劑味道帶進飲用水。 | 建議在廚房龍頭加裝可切換的淨水龍頭，並在水槽下配置五微米前置濾心與活性碳濾心，專門供應烹飪與直接飲用。 |",
    "| 浴室同時承擔淋浴、洗臉與洗衣之前的取水，熱水要在短時間內到達且溫度穩定，避免反覆放掉冷水造成浪費。 | 浴室建議裝上恆溫淋浴龍頭與低流量蓮蓬頭，並在熱水器出水管加裝防燙閥，讓全家使用時水溫固定且比較省水。 |",
    "| 洗衣機多半放在陽台或洗衣間，進水水壓要足夠且水質不能太硬，否則衣物容易殘留皂垢並縮短機器的壽命。 | 洗衣機進水端建議加裝專用前置過濾器，並搭配軟水濾心降低水垢，洗衣程式再選用適量洗劑的模式以減少漂洗次數。 |",
    "| 全家人每天喝水與煮開水都集中在飲用水這一處，水源要穩定去除餘氯與異味，濾心週期也必須跟得上實際用量。 | 飲用水建議採用逆滲透或中空絲膜系統，出水再經過活性碳改善口感，並設定半年更換濾心的提醒以免過濾效果衰退。 |",
  ].join("\n");

  it("a long reply ending in a wide table, with the scrollbar painted", () => {
    expect(locateReply(pane("grok--reply-table-scrollbar"), turn("assistant", water))).toEqual({
      fit: "clipped",
      endLine: 25,
    });
  });

  it("the same reply while Grok highlights the message", () => {
    expect(locateReply(pane("grok--reply-table-highlighted"), turn("assistant", water))).toEqual({
      fit: "clipped",
      endLine: 25,
    });
  });

  it("a short reply whose first row carries the time", () => {
    const short = "早上出門先看天氣，再決定要帶多厚的外套。\n\n| 晴 | 雨 |\n| --- | --- |\n| 薄外套 | 防水外套 |";
    expect(locateReply(pane("grok--reply-short-time"), turn("assistant", short)).fit).toBe("whole");
  });
});

