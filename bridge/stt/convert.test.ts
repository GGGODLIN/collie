import { describe, expect, test } from "bun:test";

import { convertTranscript, withConversion } from "./convert.ts";
import type { SttProvider } from "./provider.ts";

describe("stt transcript conversion", () => {
  test("zh-TW turns Simplified into Taiwan Traditional, phrases included, and leaves English alone", () => {
    expect(convertTranscript("这是从手机发出的麦克风测试。我将混入commit message。软件的信息", "zh-TW")).toBe(
      "這是從手機發出的麥克風測試。我將混入commit message。軟體的資訊",
    );
  });

  test("text already in Traditional passes through unchanged", () => {
    expect(convertTranscript("幫我跑一下測試，然後 commit 到 main", "zh-TW")).toBe("幫我跑一下測試，然後 commit 到 main");
  });

  test("a wrapped provider converts its transcript and keeps its id, status and close", async () => {
    let closed = 0;
    const inner: SttProvider = {
      id: "codex",
      status: async () => ({ available: true }),
      transcribe: async () => ({ text: "简体" }),
      close: () => {
        closed++;
      },
    };
    const wrapped = withConversion(inner, "zh-TW");

    expect(wrapped.id).toBe("codex");
    expect(await wrapped.status()).toEqual({ available: true });
    expect(await wrapped.transcribe({ audio: new Uint8Array(1), mimeType: "audio/mp4", filename: "a.m4a" })).toEqual({
      text: "簡體",
    });
    wrapped.close?.();
    expect(closed).toBe(1);
  });
});
