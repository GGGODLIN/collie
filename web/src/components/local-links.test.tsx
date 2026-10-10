import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalLinks } from "./local-links";
import { MarkdownText } from "./markdown-text";
import { AnsiOutput } from "./ansi-output";
import { fixMessage } from "@/lib/local-link";

// A tap on an agent's localhost link asks the bridge (`GET …/port/<port>`) and acts on the answer.
// `fetch` is stubbed with the probe's JSON; `window.open` is spied so the new tab is observable.

const seen: string[] = [];
let answer: () => Response = () => new Response("miss", { status: 500 });

function probeBody(loopback: boolean, tailnet: boolean | null): Response {
  return new Response(JSON.stringify({ port: 5173, loopback, tailnet, address: tailnet === null ? null : "100.101.86.18" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function renderChat(onStage = vi.fn(), canStage = true, text = "Local: http://localhost:5173/app") {
  render(
    <LocalLinks paneId="w1:p1" canStage={canStage} onStage={onStage}>
      <MarkdownText text={text} />
    </LocalLinks>,
  );
  return onStage;
}

async function tap(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByText(name));
  });
}

let opened: string[] = [];
let openAnswers: "tab" | "blocked" = "tab";

beforeEach(() => {
  seen.length = 0;
  opened = [];
  openAnswers = "tab";
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      seen.push(String(input));
      return Promise.resolve(answer());
    }),
  );
  vi.spyOn(window, "open").mockImplementation((url) => {
    opened.push(String(url));
    // Any Window will do for an opened tab: openTab only clears its `opener`, already null here.
    return openAnswers === "tab" ? window : null;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a tapped localhost link", () => {
  it("asks this pane's machine about the port and opens the tailnet address", async () => {
    answer = () => probeBody(true, true);
    renderChat();
    await tap("http://localhost:5173/app");
    expect(seen.map((url) => new URL(url, "http://x").pathname)).toEqual(["/api/pane/w1%3Ap1/port/5173"]);
    expect(opened).toEqual(["http://100.101.86.18:5173/app"]);
  });

  it("on loopback only, explains and stages the fix message, never sends it", async () => {
    answer = () => probeBody(true, false);
    const onStage = renderChat();
    await tap("http://localhost:5173/app");
    expect(opened).toEqual([]);
    expect(screen.getByText("Your phone can't reach this server")).toBeTruthy();
    await tap("Ask the agent to fix it");
    expect(onStage).toHaveBeenCalledWith(fixMessage(5173));
  });

  it("on loopback only with a locked composer, explains without the button", async () => {
    answer = () => probeBody(true, false);
    renderChat(vi.fn(), false);
    await tap("http://localhost:5173/app");
    expect(screen.getByText("Your phone can't reach this server")).toBeTruthy();
    expect(screen.queryByText("Ask the agent to fix it")).toBeNull();
  });

  it("with nothing listening, says so", async () => {
    answer = () => probeBody(false, false);
    renderChat();
    await tap("http://localhost:5173/app");
    expect(screen.getByText("Nothing is running on port 5173")).toBeTruthy();
    expect(opened).toEqual([]);
  });

  it("when the bridge cannot answer (a crew member's 501, an older bridge), opens the link as printed", async () => {
    answer = () => new Response("not implemented", { status: 501 });
    renderChat();
    await tap("http://localhost:5173/app");
    expect(opened).toEqual(["http://localhost:5173/app"]);
  });

  it("when the browser refuses the tab, offers a real link to tap", async () => {
    answer = () => probeBody(true, true);
    openAnswers = "blocked";
    renderChat();
    await tap("http://localhost:5173/app");
    const link = screen.getByText("Open in browser").closest("a");
    expect(link?.getAttribute("href")).toBe("http://100.101.86.18:5173/app");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("a code span that is one localhost URL is tappable too", async () => {
    answer = () => probeBody(true, true);
    renderChat(vi.fn(), true, "open `http://localhost:5173/` now");
    await tap("http://localhost:5173/");
    expect(opened).toEqual(["http://100.101.86.18:5173/"]);
  });

  it("the terminal mirror's link takes the same path", async () => {
    answer = () => probeBody(true, true);
    render(
      <LocalLinks paneId="w1:p1" canStage onStage={vi.fn()}>
        <AnsiOutput text={"  ➜  Local:   http://localhost:5173/\n"} />
      </LocalLinks>,
    );
    await tap("http://localhost:5173/");
    expect(opened).toEqual(["http://100.101.86.18:5173/"]);
  });

  it("any other URL stays a plain new-tab anchor and asks nothing", async () => {
    renderChat(vi.fn(), true, "see https://example.com/docs");
    const link = screen.getByText("https://example.com/docs").closest("a");
    expect(link?.getAttribute("target")).toBe("_blank");
    fireEvent.click(link!);
    expect(seen).toEqual([]);
  });

  it("with no provider (History, a Files preview) a localhost link is the plain anchor it was", () => {
    render(<MarkdownText text="Local: http://localhost:5173/app" />);
    const link = screen.getByText("http://localhost:5173/app").closest("a");
    expect(link?.getAttribute("target")).toBe("_blank");
    fireEvent.click(link!);
    expect(seen).toEqual([]);
  });
});
