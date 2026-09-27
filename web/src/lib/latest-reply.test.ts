import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitLines } from "./blocks";
import { buildBlocks } from "./harness";
import { parseAnsi } from "./ansi";
import { fold, locateReply, newestExchange, newestReply, replyProse, settleText, sourceOrderRows } from "./latest-reply";
import type { TranscriptEntry, TranscriptPart } from "./types";

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
  const source = [
    "我建議先處理這三題，理由都列在表格裡，你可以逐題看。",
    "",
    "| 題目 | 建議 | 信心 |",
    "|---|---|---|",
    "| 1. 要不要重問 Pro | 不重問。它的限制是這條管道打不開 GitHub，重送一樣讀不到。真的要它看全部內容，只能把檔案印進對話給它讀，但那就不算從 GitHub 用乾淨的視角看了 | 中 |",
    "| 2. 計畫要不要加 Pro 的三項驗收 | 要。① 和 ② 可以在這台機器用一個臨時、空白的使用者目錄實測，不動你現在的設定；③ 寫進 README，並實際走一次 | 高 |",
    "| 3. 其他照我上一則的建議 | 只支援原始碼安裝、README 最上面補一段 fork 說明、更新提示這次只寫說明不改程式 | 中 |",
    "",
    "你可以回「全照建議」，或挑題號調整。照建議的話，我會先做驗收 ① 和 ②，把結果拿回來，再寫 README。",
  ].join("\n");
  // The screen as captured: the table's top has scrolled off, so the reply is clipped.
  const painted = [
    "  │ 1. 要不要重問 Pro    │ GitHub，重送一樣讀不到。真的要它看全部內容，只能把檔案印進對話給它讀，但那就不算從    │ 中   │",
    "  │                      │ GitHub 用乾淨的視角看了                                                               │      │",
    "  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┼──────┤",
    "  │ 2. 計畫要不要加 Pro  │ 要。① 和 ② 可以在這台機器用一個臨時、空白的使用者目錄實測，不動你現在的設定；③ 寫進   │ 高   │",
    "  │ 的三項驗收           │ README，並實際走一次                                                                  │      │",
    "  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┼──────┤",
    "  │ 3.                   │ 只支援原始碼安裝、README 最上面補一段 fork 說明、更新提示這次只寫說明不改程式         │ 中   │",
    "  │ 其他照我上一則的建議 │                                                                                       │      │",
    "  └──────────────────────┴───────────────────────────────────────────────────────────────────────────────────────┴──────┘",
    "",
    "  你可以回「全照建議」，或挑題號調整。照建議的話，我會先做驗收 ① 和 ②，把結果拿回來，再寫 README。",
  ];
  const after = ["", "✻ Cogitated for 36s · done 12:11 PM"];

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

  it("finds a tail that lies wholly inside the table's last row", () => {
    const tableEnd = source.slice(0, source.lastIndexOf("\n\n"));
    const { fit, endLine } = locateReply(painted.slice(0, 9).join("\n"), turn("assistant", tableEnd));
    expect(fit).toBe("clipped");
    // The last source row spans two painted rows; the reply ends on the lower one, above the frame.
    expect(endLine).toBe(7);
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
  const lead = "開頭已經捲出畫面的一段很長的前文，只是為了讓這則回覆被判定成 clipped。";

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

