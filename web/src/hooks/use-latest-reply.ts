import { useEffect, useState } from "react";

import { fetchHistory } from "@/lib/api";
import { newestExchange, type LatestExchange } from "@/lib/latest-reply";
import { paneScopeKey, type Scope } from "@/lib/scope";

// Keeps the pane view holding the agent's newest finished exchange, read from its own session log.
//
// The pane route CANNOT get this from the mirror: an agent's TUI runs on the alternate screen, so
// `pane.read` returns the viewport and nothing above it (see lib/latest-reply.ts for the full why).
// The journal is a second source with a different cost, which is what this hook is really managing.
//
// WHEN IT FETCHES. Not on the poll. The mirror revalidates every ~1.5 s and a fetch here re-parses the
// agent's log bridge-side whenever its mtime moved (bridge/journal/store.ts caches on size+mtime), so
// fetching per poll would put a whole-journal parse on a loop. Instead it waits for the mirror text to
// SETTLE — unchanged for SETTLE_MS — which a streaming reply never does. In practice that is one fetch
// per finished message, the same cost as opening the history route once, which is what this replaces.
//
// The first fetch is immediate rather than settle-delayed: opening a pane whose reply is already
// clipped should show it, not make you wait out a timer for output that may never change again.

/** Turns requested: the page the history route opens on. Long enough that a reply's prompt is in it. */
const TURNS = 200;

/** How long the mirror must hold still before its content counts as a finished message. */
const SETTLE_MS = 1500;

/**
 * The agent's newest exchange — its last spoken reply paired with the prompt it answered — or null
 * when there isn't one (yet), the pane has no journal, or the caller switched this off.
 *
 * Errors are swallowed on purpose: this is an enhancement over the mirror, and the mirror is still
 * right there. A failed read must cost nothing more than the card not appearing.
 */
export function useLatestReply({
  paneId,
  scope,
  enabled,
  mirrorText,
}: {
  paneId: string;
  /** Which machine + session this pane lives on — the same address every other pane read carries. */
  scope?: Scope;
  /** False for a pane with no journal, or when the operator turned the feature off. */
  enabled: boolean;
  /** The mirror as displayed — its stillness is the trigger, its content is not read here. */
  mirrorText: string;
}): LatestExchange | null {
  const [exchange, setExchange] = useState<LatestExchange | null>(null);
  const [settled, setSettled] = useState(mirrorText);

  // An exchange belongs to the pane it was read from — never let one outlive a switch to another
  // pane, where locateReply would be comparing it against a screen it has nothing to do with. Keyed
  // on the ADDRESS, not the pane id: the same pane id on another host or session is a different pane.
  const address = paneScopeKey(scope, paneId);
  useEffect(() => setExchange(null), [address]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setSettled(mirrorText), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [mirrorText, enabled]);

  useEffect(() => {
    if (!enabled || settled === "") return;
    const abort = new AbortController();
    let live = true;
    void (async () => {
      try {
        const page = await fetchHistory(paneId, { limit: TURNS }, scope, abort.signal);
        if (live && page.available) setExchange(newestExchange(page.entries));
      } catch {
        // A cancelled or failed read leaves the previous exchange in place.
      }
    })();
    return () => {
      live = false;
      abort.abort();
    };
    // `scope` is safe in a dependency array: scopes read off a URL are interned to one frozen
    // instance per (host, session), so its identity is as stable as the string it replaced.
  }, [paneId, scope, enabled, settled]);

  return enabled ? exchange : null;
}
