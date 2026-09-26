import { useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";

import { MarkdownText } from "@/components/markdown-text";
import { BottomSheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useLocale } from "@/hooks/use-locale";
import * as api from "@/lib/api";
import { describeApiError, describeThrownError } from "@/lib/api-error-message";
import { t } from "@/lib/i18n";
import type { Scope } from "@/lib/scope";

export type RetellMode = "plain" | "lost";

type RetellState =
  | { phase: "closed" }
  | { phase: "loading"; mode: RetellMode }
  | { phase: "failed"; mode: RetellMode; message: string }
  | { phase: "done"; mode: RetellMode; label: string; answer: string; cached: boolean };

/**
 * One pane's retelling, started from a tap and never from an effect.
 *
 * Every request carries a ticket; an answer whose ticket is no longer the newest one — the sheet
 * was closed, the other mode was asked for, or the component moved to another pane — is dropped,
 * so a late reply can never be shown as the retelling of what is on screen now.
 */
export function useRetell(paneId: string, scope?: Scope) {
  // Held with the pane it belongs to, so moving to another pane reads as closed without an effect,
  // and a reply that lands after the move is filed under the pane it was asked for.
  const [held, setHeld] = useState<{ paneId: string; state: RetellState }>({ paneId, state: CLOSED });
  const ticket = useRef(0);
  const state = held.paneId === paneId ? held.state : CLOSED;

  async function start(mode: RetellMode, fresh = false) {
    const mine = ++ticket.current;
    const target = paneId;
    setHeld({ paneId: target, state: { phase: "loading", mode } });
    let next: RetellState;
    try {
      const res = await api.retellPane(target, mode, fresh, scope);
      next = res.ok
        ? { phase: "done", mode, label: res.label, answer: res.answer, cached: res.cached }
        : { phase: "failed", mode, message: describeApiError(res, t("retell.failed")) };
    } catch (e) {
      next = { phase: "failed", mode, message: describeThrownError(e) };
    }
    if (mine === ticket.current) setHeld({ paneId: target, state: next });
  }

  function close() {
    ticket.current += 1;
    setHeld({ paneId, state: CLOSED });
  }

  return { state, start, close };
}

const CLOSED: RetellState = { phase: "closed" };

interface RetellSheetProps {
  retell: ReturnType<typeof useRetell>;
}

// The reading surface for a retelling: same screen, scrollable, closed back to where you were. It
// holds no conversation and no history — one answer, and a way to ask for it again.
export function RetellSheet({ retell }: RetellSheetProps) {
  useLocale();
  const { state, start, close } = retell;
  const mode = state.phase === "closed" ? "plain" : state.mode;
  const title = mode === "plain" ? t("retell.plain") : t("retell.lost");
  return (
    <BottomSheet open={state.phase !== "closed"} onClose={close} title={title}>
      {state.phase === "loading" && (
        <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("retell.loading")}
        </p>
      )}
      {state.phase === "failed" && (
        <Notice variant="box" tone="danger" announce="alert">
          {state.message}
        </Notice>
      )}
      {state.phase === "done" && (
        <div className="flex flex-col gap-3">
          <MarkdownText text={state.answer} className="text-sm leading-relaxed" />
          {state.cached && <p className="text-xs text-muted-foreground">{t("retell.cached")}</p>}
        </div>
      )}
      {(state.phase === "done" || state.phase === "failed") && (
        <Button variant="outline" size="sm" className="mt-3 self-start" onClick={() => void start(mode, true)}>
          <RotateCw aria-hidden />
          {t("retell.again")}
        </Button>
      )}
    </BottomSheet>
  );
}
