import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";
import { clearStatus } from "@/lib/status";
import { __resetOperatorCommands } from "@/lib/operator-config";
import type { AgentView } from "@/lib/types";
import { PaneActionsSheet } from "./pane-actions-sheet";
import { useRetell } from "./retell-sheet";

// Switch account (bridge/account-switch.ts) and retell (ADR 0074) as the pane sheet offers them.

const claude: AgentView = {
  paneId: "w1:p1",
  workspaceId: "w1",
  workspaceLabel: "webapp",
  workspaceNumber: 1,
  tabId: "w1:t1",
  agent: "claude",
  status: "idle",
  cwd: "/home/you/webapp",
  focused: false,
  hasSession: true,
};

function withAccounts(accounts: string[]) {
  server.use(
    http.get("/api/config", () =>
      HttpResponse.json({ push: false, vapidPublicKey: "", accounts }),
    ),
  );
}

function captureSwitch() {
  const bodies: unknown[] = [];
  server.use(
    http.post("/api/pane/:id/switch-account", async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({ ok: true });
    }),
  );
  return bodies;
}

function renderSheet(pane: AgentView, extra: Partial<React.ComponentProps<typeof PaneActionsSheet>> = {}) {
  const props = { open: true, onClose: vi.fn(), pane, onRenamed: vi.fn(), onClosed: vi.fn(), ...extra };
  render(<PaneActionsSheet {...props} />);
  return props;
}

beforeEach(() => {
  clearStatus();
  __resetOperatorCommands();
});

describe("switch account", () => {
  it("an idle Claude switches on the first tap of an account", async () => {
    withAccounts(["Team-P", "Team-S"]);
    const bodies = captureSwitch();
    const user = userEvent.setup();
    const props = renderSheet(claude);
    await user.click(await screen.findByRole("button", { name: "Switch account" }));
    await user.click(screen.getByRole("button", { name: "Team-S" }));
    await waitFor(() => expect(bodies).toEqual([{ account: "Team-S", interrupt: false }]));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("a working Claude needs a second tap, and only then says it may interrupt", async () => {
    withAccounts(["Team-S"]);
    const bodies = captureSwitch();
    const user = userEvent.setup();
    renderSheet({ ...claude, status: "working" });
    await user.click(await screen.findByRole("button", { name: "Switch account" }));
    await user.click(screen.getByRole("button", { name: "Team-S" }));
    expect(bodies).toEqual([]);
    await user.click(screen.getByRole("button", { name: /interrupt this turn and switch to Team-S/ }));
    await waitFor(() => expect(bodies).toEqual([{ account: "Team-S", interrupt: true }]));
  });

  it("a pane the bridge sees working arms the row, and the next tap interrupts", async () => {
    withAccounts(["Team-S"]);
    const bodies: unknown[] = [];
    server.use(
      http.post("/api/pane/:id/switch-account", async ({ request }) => {
        // SAFETY: the only sender in this case is api.switchAccount, whose body always carries `interrupt`.
        const body = (await request.json()) as { interrupt: boolean };
        bodies.push(body);
        return body.interrupt
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ ok: false, error: "working", code: "account.confirm_interrupt" }, { status: 409 });
      }),
    );
    const user = userEvent.setup();
    renderSheet(claude);
    await user.click(await screen.findByRole("button", { name: "Switch account" }));
    await user.click(screen.getByRole("button", { name: "Team-S" }));
    await user.click(await screen.findByRole("button", { name: /interrupt this turn and switch to Team-S/ }));
    await waitFor(() =>
      expect(bodies).toEqual([
        { account: "Team-S", interrupt: false },
        { account: "Team-S", interrupt: true },
      ]),
    );
  });

  it("is not offered for a pane with no session", async () => {
    withAccounts(["Team-S"]);
    renderSheet({ ...claude, hasSession: false });
    await screen.findByRole("button", { name: "Rename" });
    // Let the config read land before asserting the row stays absent.
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Switch account" })).toBeNull();
  });
});

describe("retell", () => {
  it("the two rows hand the mode to the caller", async () => {
    const onRetell = vi.fn();
    const user = userEvent.setup();
    renderSheet(claude, { onRetell });
    await user.click(screen.getByRole("button", { name: "Lost" }));
    expect(onRetell).toHaveBeenCalledWith("lost");
  });

  it("a reply that lands after the sheet was closed is dropped", async () => {
    let release: () => void = () => {};
    let entered: () => void = () => {};
    const inHandler = new Promise<void>((r) => (entered = r));
    server.use(
      http.post("/api/pane/:id/retell", async () => {
        const held = new Promise<void>((r) => (release = r));
        entered();
        await held;
        return HttpResponse.json({ ok: true, mode: "plain", label: "白話", answer: "late", cached: false, source: "x" });
      }),
    );
    const { result } = renderHook(() => useRetell("w1:p1"));
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.start("plain");
    });
    expect(result.current.state.phase).toBe("loading");
    act(() => result.current.close());
    await act(async () => {
      await inHandler;
      release();
      await pending;
    });
    expect(result.current.state.phase).toBe("closed");
  });

  it("a finished retelling shows its answer", async () => {
    server.use(
      http.post("/api/pane/:id/retell", () =>
        HttpResponse.json({ ok: true, mode: "lost", label: "跟丟了", answer: "整段", cached: true, source: "x" }),
      ),
    );
    const { result } = renderHook(() => useRetell("w1:p1"));
    await act(() => result.current.start("lost"));
    expect(result.current.state).toEqual({ phase: "done", mode: "lost", label: "跟丟了", answer: "整段", cached: true });
  });
});
