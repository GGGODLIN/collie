import type { AgentView, OperatorCommand } from "@/lib/types";

import { regressionAgent } from "@/test/fork-regression-data";

// Moved verbatim from the unit tests so the browser tier reuses those inputs
// instead of growing a second payload. The original assertions stay put.

/** agent-commands.test.ts — the omp row that replaces that harness's whole catalog. */
export const ompForkIn: OperatorCommand = {
  agent: "omp",
  command: "/fork-in-herdr",
  description: "Fork into a new herdr tab",
  takesArg: false,
  argHint: "",
};

/** harness-bar.test.ts — one Claude bar row, label included. */
export const operatorBarStatus: OperatorCommand = {
  agent: "claude",
  command: "/statusline",
  description: "Custom command",
  takesArg: false,
  argHint: "",
  confirm: false,
  bar: true,
  barLabel: "Status",
};

/** harness-bar.test.tsx — a shipped dangerous command placed on the bar. */
export const operatorBarWipe: OperatorCommand = {
  agent: "claude",
  command: "/clear",
  description: "Custom command",
  takesArg: false,
  argHint: "",
  confirm: false,
  bar: true,
  barLabel: "Wipe",
};

/** triage.test.ts — two Recent panes whose state changed at the same moment. */
export const tiedRecentAgents: AgentView[] = [
  regressionAgent("first", "idle", { active: 1, seen: 100 }),
  regressionAgent("second", "idle", { active: 1, seen: 900 }),
];

/** triage.test.ts — an older bridge that reports no timestamps at all. */
export const untimedBridgeAgents: AgentView[] = [
  regressionAgent("b1", "blocked"),
  regressionAgent("b2", "blocked"),
  regressionAgent("w1", "working"),
  regressionAgent("i1", "idle"),
  regressionAgent("d1", "done"),
];
