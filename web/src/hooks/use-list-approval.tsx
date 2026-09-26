import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFetcher, useRevalidator } from "react-router";

import { useHostWriteBlock } from "@/components/crew-provider";
import { PromptSelectBlock, type PromptBlockAction } from "@/components/prompt-select-block";
import { RawMirror } from "@/components/raw-mirror";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { Notice } from "@/components/ui/notice";
import { BottomSheet } from "@/components/ui/sheet";
import { useLocale } from "@/hooks/use-locale";
import type { PaneOpen } from "@/hooks/use-pane-open";
import { parseAnsi } from "@/lib/ansi";
import { lineText, splitLines } from "@/lib/blocks";
import { buildBlocks } from "@/lib/harness";
import { paneScope } from "@/lib/hosts";
import { t } from "@/lib/i18n";
import { isCatchingUp, isLocked, useCatchingUp, useLocked } from "@/lib/idle";
import type { HomeData, PaneData } from "@/lib/loaders";
import { panePath } from "@/lib/nav";
import { usePairing } from "@/lib/pairing";
import { stampSend } from "@/lib/poll-intent";
import { submitPromptOption } from "@/lib/prompt-action";
import { paneScopeKey, type Scope } from "@/lib/scope";
import { setStatus } from "@/lib/status";
import { isReadOnly, type AgentView } from "@/lib/types";

interface ApprovalTarget {
  pane: AgentView;
  scope: Scope;
  row?: HTMLElement;
}

function permissionOf(data: PaneData | undefined, agent: string) {
  if (!data || data.error || data.truncated || data.emptyRead) return null;
  const lines = splitLines(parseAnsi(data.text));
  // bridge/server.ts 的 expected_prompt 上限；不能裁掉指令後仍提供批准。
  if (lines.map(lineText).join("\n").length > 8192) return null;
  const blocks = buildBlocks(lines, { agent });
  const block = blocks.find((b) => b.kind === "prompt-select");
  if (block?.kind !== "prompt-select" || block.prompt.family !== "permission" || block.prompt.feedback) return null;
  return { block, context: blocks.filter((b) => b.kind === "raw").flatMap((b) => b.lines) };
}

interface ApprovalRequestProps {
  target: ApprovalTarget;
  home: HomeData;
  onClose: () => void;
  onOpenPane: () => void;
}

function ApprovalRequest({ target, home, onClose, onOpenPane }: ApprovalRequestProps) {
  useLocale();
  const fetcher = useFetcher<PaneData>();
  const revalidator = useRevalidator();
  const path = panePath(target.pane.paneId, target.scope);
  const { load } = fetcher;
  // fetcher 隨既有 revalidator 更新；關閉時卸載，不留下背景 pane 掃描。
  useEffect(() => { void load(path); }, [load, path]);
  const current = home.agents.find((pane) =>
    paneScopeKey(paneScope(home.scope, pane, home.servers, home.sessions), pane.paneId) ===
    paneScopeKey(target.scope, target.pane.paneId),
  );
  const gone = !current || current.status !== "blocked" || current.agent !== target.pane.agent ||
    current.workspaceId !== target.pane.workspaceId || current.tabId !== target.pane.tabId ||
    current.cwd !== target.pane.cwd;
  const { refused } = usePairing();
  const hostBlock = useHostWriteBlock(target.pane.host ?? target.scope.host);
  const readOnly = isReadOnly(home.device) || refused;
  const locked = useLocked();
  const catchingUp = useCatchingUp();
  const live = fetcher.data;
  const permission = useMemo(() => permissionOf(live, target.pane.agent), [live, target.pane.agent]);
  // 固定使用者看到的畫面；新提示只能由下一次明確點擊開啟，不能換掉指尖下的選項。
  const [frozen, setFrozen] = useState<{ data: PaneData; permission: NonNullable<typeof permission> } | null>(null);
  const changed = frozen !== null && (permission === null || live?.text !== frozen.data.text || live.revision !== frozen.data.revision);
  const invalid = gone || home.error || home.bridge !== "connected" || locked || catchingUp || changed;
  const canSend = useRef(false);
  useLayoutEffect(() => {
    canSend.current = !invalid && !readOnly && !hostBlock && frozen !== null;
    return () => { canSend.current = false; };
  }, [invalid, readOnly, hostBlock, frozen]);
  const sending = useRef(false);
  const close = useCallback(() => {
    canSend.current = false;
    onClose();
  }, [onClose]);
  useEffect(() => {
    const hide = () => { if (document.hidden) close(); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [close]);
  useEffect(() => {
    if (invalid || document.hidden) close();
    else if (live && !frozen) {
      if (permission) setFrozen({ data: live, permission });
      else onOpenPane();
    }
  }, [invalid, live, frozen, permission, close, onOpenPane]);

  const allowed = () => canSend.current && !document.hidden && !isLocked() && !isCatchingUp();
  async function answer(action: PromptBlockAction): Promise<boolean> {
    if (!allowed() || sending.current || !frozen || action.kind !== "option") return false;
    sending.current = true;
    stampSend(target.pane.paneId);
    const result = await submitPromptOption({
      paneId: target.pane.paneId, scope: target.scope, agent: target.pane.agent,
      requestedLines: frozen.data.requestedLines, detectedRevision: frozen.data.revision,
      prompt: frozen.permission.block.prompt, option: action.option, canSend: allowed,
      expectedText: frozen.data.text,
    });
    if (result.status === "sent") setStatus(t("chat.status.sent"), "success");
    else if (result.status === "changed") setStatus(t("chat.status.menuChanged"), "warn");
    else setStatus(result.error, "error");
    // 不論成功或結果不明都撤下舊卡，不讓第二次按鈕重送同一批准。
    close();
    void revalidator.revalidate();
    return result.status === "sent";
  }

  if (!frozen || invalid) return null;
  return (
    <BottomSheet open onClose={close} title={t("prompt.family.permission")}>
      <div className="flex flex-col gap-3">
        <RawMirror lines={frozen.permission.context} />
        <Collapse open={readOnly || Boolean(hostBlock)}>
          <Notice variant="box" tone="caution">{readOnly ? t("chat.status.readOnly") : hostBlock}</Notice>
        </Collapse>
        <PromptSelectBlock
          prompt={frozen.permission.block.prompt}
          lines={frozen.permission.block.lines}
          disabled={readOnly || Boolean(hostBlock)}
          onAction={answer}
        />
        <Button variant="outline" className="min-h-11" onClick={() => { canSend.current = false; onOpenPane(); }}>
          {t("approval.openPane")}
        </Button>
      </div>
    </BottomSheet>
  );
}

interface ListApproval {
  open: PaneOpen["open"];
  press: PaneOpen["press"];
  sheet: ReactNode;
}

export function useListApproval(home: HomeData, paneOpen: PaneOpen): ListApproval {
  const [target, setTarget] = useState<ApprovalTarget | null>(null);
  const close = useCallback(() => setTarget(null), []);
  const openPane = useCallback(() => {
    if (!target) return;
    setTarget(null);
    paneOpen.open(target.pane, target.row);
  }, [target, paneOpen]);
  return {
    press: (pane) => { if (pane.status !== "blocked") paneOpen.press(pane); },
    open: (pane, row) => {
      if (isLocked() || isCatchingUp() || document.hidden) return;
      if (pane.status !== "blocked") {
        setTarget(null);
        paneOpen.open(pane, row);
        return;
      }
      setTarget({ pane, row, scope: paneScope(home.scope, pane, home.servers, home.sessions) });
    },
    sheet: target ? <ApprovalRequest
      key={paneScopeKey(target.scope, target.pane.paneId)}
      target={target} home={home} onClose={close} onOpenPane={openPane}
    /> : null,
  };
}
