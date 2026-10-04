import type { AgentStatus, TranscriptEntry } from "@/lib/types";
import { paneTextWithDraft } from "@/test/handlers";

// 與原單測共用輸入，避免 browser 案例自造另一份 API 資料。

/** pane-account-retell.test.tsx:24 — the Claude fixture's hasSession. */
export const accountHasSession = true;
/** pane-account-retell.test.tsx:21 — idle case status. */
export const accountIdleStatus = "idle" satisfies AgentStatus;
/** pane-account-retell.test.tsx:73 — working case status. */
export const accountWorkingStatus = "working" satisfies AgentStatus;
/** pane-account-retell.test.tsx:59 */
export const accountIdleLabels = ["Work", "Personal"] as const;
/** pane-account-retell.test.tsx:70 */
export const accountWorkingLabels = ["Personal"] as const;
/** pane-account-retell.test.tsx:64 and :75 — the tapped label. */
export const accountChoice = "Personal";
/** pane-account-retell.test.tsx:41 — the handler's success body. */
export const switchAccepted = { ok: true } as const;

interface AccountsConfigFixture {
  push: false;
  vapidPublicKey: "";
  accounts: readonly string[];
}

export function accountsConfig(accounts: readonly string[]): AccountsConfigFixture {
  return { push: false, vapidPublicKey: "", accounts };
}

/** list-approval.test.tsx:85 */
export const permissionYes = "Yes";
/** list-approval.test.tsx:87 */
export const permissionNo = "No";
/** list-approval.test.tsx:145 and :169 — the capture token those tests replace. */
export const permissionCommand = "mkfifo fixture-fifo";
/** list-approval.test.tsx:145 and :169 */
export const changedCommand = "rm other-file";
/** list-approval.test.tsx:113 — the unknown arm of the each() table. */
export const unknownModalScreen = "An unknown modal\n1. Yes\n2. No";

/** list-approval.test.tsx:145 */
export function changedPermissionScreen(capture: string): string {
  return capture.replaceAll(permissionCommand, changedCommand);
}

/** agent-chat.test.tsx:2656-2660 */
export const fullReply = [
  "Short answer: approve-only. The author knows when they want it to land; your job was the",
  "approval. Enabling auto-merge makes you the actor for the merge itself, which is a materially",
  "bigger claim than saying this looks fine to me.",
].join(" ");
/** agent-chat.test.tsx:2698 */
export const fullReplyPrompt = "Why is the release held?";
/** agent-chat.test.tsx:2707 */
export const fullReplyAfter = "abc1234 fix";
/** agent-chat.test.tsx:2718 — the opening the card must show. */
export const fullReplyHead = "Short answer: approve-only";
/** agent-chat.test.tsx:2721 — the tail the mirror must not repeat once the card covers it. */
export const fullReplyTail = "bigger claim";
/** agent-chat.test.tsx:2775 */
export const fullReplyIdentityScreen = "an entirely different screen";
/** agent-chat.test.tsx:2701 */
export const fullReplyHasSession = true;
/** agent-chat.test.tsx:2701 */
export const fullReplyReadableLines = 51;

/** agent-chat.test.tsx:2710 — same call, so the draft box is the helper's current draft. */
export function fullReplyScreen(): string {
  return paneTextWithDraft(`${fullReply.slice(120)}\n\nBash(git log --oneline)\n  ${fullReplyAfter}`);
}

interface FullReplyHistoryFixture {
  paneId: "w1:p1";
  available: true;
  entries: TranscriptEntry[];
  hasMore: false;
  total: number;
  fileTruncated: false;
}

export function fullReplyHistory(text: string, prompt?: string): FullReplyHistoryFixture {
  const entries: TranscriptEntry[] = [
    ...(prompt
      ? [
          {
            uuid: "prompt-1",
            ts: "2026-08-28T09:13:00.000Z",
            role: "user" as const,
            parts: [{ kind: "text" as const, text: prompt }],
          },
        ]
      : []),
    {
      uuid: "reply-1",
      ts: "2026-08-28T09:14:00.000Z",
      role: "assistant" as const,
      parts: [{ kind: "text" as const, text }],
    },
  ];
  return {
    paneId: "w1:p1",
    available: true,
    entries,
    hasMore: false,
    total: entries.length,
    fileTruncated: false,
  };
}
