// An agent's `http://localhost:<port>` link, opened from the phone (ADR 9007). On the phone
// `localhost` is the phone itself, so the link is useless as printed. The bridge reports what answers
// on that port of its own machine, and the link is rewritten to the machine's tailnet address,
// or explained when it cannot work.

import type { PortProbe } from "@/lib/api";

/** The hosts that mean "the machine the agent runs on" in a link it printed. */
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

/** Same floor as the bridge's `MIN_PROBE_PORT`: a link to a system port opens as it always did. */
export const MIN_LOCAL_PORT = 1024;

export interface LocalLink {
  port: number;
  url: URL;
}

/**
 * The link as a local dev-server link, or null when it is any other URL. Plain `http:` with an
 * explicit port only: an `https:` dev server carries a certificate for `localhost` that no
 * rewritten address would match, and a link with no port is not a dev server's.
 */
export function localLink(href: string): LocalLink | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" || !LOCAL_HOSTS.has(url.hostname) || url.port === "") return null;
  const port = Number(url.port);
  return port >= MIN_LOCAL_PORT ? { port, url } : null;
}

/** What a tap on a local link does, once the bridge has answered (or not). */
export type LocalOutcome =
  /** Open this address: the machine's tailnet IP, the path, query and fragment kept. */
  | { kind: "open"; href: string }
  /** Something listens on loopback only, so the phone cannot reach it. */
  | { kind: "loopback"; port: number }
  /** Nothing listens on the port. */
  | { kind: "closed"; port: number }
  /** No answer to improve on (an older bridge, a crew member, no tailnet address): the link as printed. */
  | { kind: "as-is"; href: string };

export function localOutcome(link: LocalLink, probe: PortProbe | null): LocalOutcome {
  if (probe === null) return { kind: "as-is", href: link.url.href };
  if (probe.tailnet === true && probe.address !== null) {
    const url = new URL(link.url.href);
    // The IP, never the MagicDNS name: Vite refuses a request addressed to a name it was not told
    // about (403) and accepts any IP (verified against Vite 8.1, 2026-10-10).
    url.hostname = probe.address;
    return { kind: "open", href: url.href };
  }
  if (!probe.loopback) return { kind: "closed", port: link.port };
  if (probe.tailnet === null) return { kind: "as-is", href: link.url.href };
  return { kind: "loopback", port: link.port };
}

/**
 * The message the "Ask the agent to fix it" button puts in the composer. English on every locale:
 * it is text sent to the terminal for the agent, like a quick reply (ADR 0030). It names no
 * framework or flag, because the agent can see the project and the phone cannot.
 */
export function fixMessage(port: number): string {
  return (
    `The dev server on port ${port} only accepts connections from this machine, so I can't open it ` +
    `from my phone over Tailscale. Please restart it listening on all interfaces, using whichever ` +
    `option this project's tooling provides, and save that setting in the project's config so it ` +
    `stays that way. Then print the link again.`
  );
}
