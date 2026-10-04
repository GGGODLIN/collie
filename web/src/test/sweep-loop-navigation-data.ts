import type { AgentView } from "@/lib/types";

// The Focus-order herd from web/src/lib/dash-view.test.ts. Moved here so the
// browser case can serve the same objects. The unit file's expects stay on
// this array; do not rebuild it there.

function pane(id: string, ws: number, status: AgentView["status"], extra: Partial<AgentView> = {}): AgentView {
  return {
    paneId: `w${ws}:${id}`,
    workspaceId: `w${ws}`,
    workspaceLabel: `ws${ws}`,
    workspaceNumber: ws,
    tabId: `w${ws}:t1`,
    agent: "claude",
    status,
    cwd: `/home/you/ws${ws}`,
    focused: false,
    ...extra,
  };
}

// ws1: a blocked pane between two quiet ones. ws2: nothing urgent. ws3: a ready-unseen pane, then a
// blocked one, in that order.
export const focusFilterOrderAgents: AgentView[] = [
  pane("p1", 1, "working"),
  pane("p2", 1, "blocked"),
  pane("p3", 1, "idle"),
  pane("p1", 2, "working"),
  pane("p2", 2, "idle"),
  pane("p1", 3, "done", { lastActiveAt: 20, lastSeenAt: 10 }),
  pane("p2", 3, "blocked"),
];
