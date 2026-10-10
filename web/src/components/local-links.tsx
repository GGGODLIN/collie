import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/sheet";
import { useLocale } from "@/hooks/use-locale";
import { probePort } from "@/lib/api";
import { t } from "@/lib/i18n";
import { fixMessage, localLink, localOutcome, type LocalLink } from "@/lib/local-link";
import type { Scope } from "@/lib/scope";

// An agent's `http://localhost:<port>` link, tapped on the phone (ADR 9007). The pane view provides
// the opener; the chat prose and the terminal mirror ask it for each URL they draw, and a URL it
// does not claim stays the plain new-tab anchor it always was. A tap asks the bridge what answers on
// that port, then opens the machine's tailnet address, or says why it cannot, or (with no answer)
// opens the link as printed. With no opener (History, a Files preview) nothing changes.

/** A tap handler for a local link, or null when the href is not one. */
export type LocalLinkOpener = (href: string) => (() => void) | null;

const LocalLinkContext = createContext<LocalLinkOpener | null>(null);

export function useLocalLinks(): LocalLinkOpener | null {
  return useContext(LocalLinkContext);
}

type SheetBody = { kind: "loopback"; port: number } | { kind: "closed"; port: number } | { kind: "open"; href: string };

/**
 * A new tab at `href`, or false when the browser refused it. The tab opens after the probe's round
 * trip, so a strict popup rule can count it as unrequested; `window.open` answers null then, and the
 * sheet offers a real anchor the operator taps. `noopener` would make it answer null always, so the
 * opener is cut by hand instead: the page is an agent's dev server and must not reach this one.
 */
function openTab(href: string): boolean {
  const tab = window.open(href, "_blank");
  if (tab === null) return false;
  tab.opener = null;
  return true;
}

interface LocalLinksProps {
  paneId: string;
  scope?: Scope;
  /** Whether the composer takes text right now (not read-only, not gone, not a saved copy). */
  canStage: boolean;
  /** Put text in the composer, never send it (ADR 9002). */
  onStage: (text: string) => void;
  children: ReactNode;
}

export function LocalLinks({ paneId, scope, canStage, onStage, children }: LocalLinksProps) {
  useLocale();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<SheetBody | null>(null);
  // The opener is a context value read by every drawn URL, so it stays one function for the view's
  // life and reads the pane's address through this ref.
  const target = useRef({ paneId, scope });
  target.current = { paneId, scope };

  const show = useCallback((next: SheetBody) => {
    setBody(next);
    setOpen(true);
  }, []);

  const follow = useCallback(
    async (link: LocalLink) => {
      const { paneId: id, scope: at } = target.current;
      const probe = await probePort(id, link.port, at).catch(() => null);
      const outcome = localOutcome(link, probe);
      if (outcome.kind === "open" || outcome.kind === "as-is") {
        if (!openTab(outcome.href)) show({ kind: "open", href: outcome.href });
        return;
      }
      show(outcome);
    },
    [show],
  );

  const opener = useCallback<LocalLinkOpener>(
    (href) => {
      const link = localLink(href);
      return link === null ? null : () => void follow(link);
    },
    [follow],
  );

  const close = () => setOpen(false);

  return (
    <LocalLinkContext.Provider value={opener}>
      {children}
      <BottomSheet open={open} onClose={close} title={body === null ? undefined : titleOf(body)}>
        {body !== null && (
          <div className="flex flex-col gap-4 text-sm">
            {body.kind === "loopback" && (
              <>
                <p className="text-muted-foreground">{t("localLink.loopback.body", { port: body.port })}</p>
                {canStage && (
                  <div className="flex flex-col gap-1.5">
                    <Button
                      className="w-fit"
                      onClick={() => {
                        onStage(fixMessage(body.port));
                        close();
                      }}
                    >
                      {t("localLink.loopback.fix")}
                    </Button>
                    <p className="text-xs text-muted-foreground">{t("localLink.loopback.fixHint")}</p>
                  </div>
                )}
              </>
            )}
            {body.kind === "closed" && <p className="text-muted-foreground">{t("localLink.closed.body")}</p>}
            {body.kind === "open" && (
              <>
                <p className="break-all font-mono text-xs text-muted-foreground">{body.href}</p>
                <a
                  href={body.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                  className={buttonVariants({ className: "w-fit" })}
                >
                  {t("localLink.open.action")}
                </a>
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </LocalLinkContext.Provider>
  );
}

function titleOf(body: SheetBody): string {
  if (body.kind === "loopback") return t("localLink.loopback.title");
  if (body.kind === "closed") return t("localLink.closed.title", { port: body.port });
  return t("localLink.open.title");
}
