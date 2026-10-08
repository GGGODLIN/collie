// The Gaddi mark: the pixel-art head of a Gaddi dog. Fork-only (FORK.md, "Gaddi brand"): upstream's
// generated orbit mark is ColliePWA's logo, which its TRADEMARKS.md keeps out of a fork.
//
//   <CollieMark size={132} />                            the mark
//   <CollieMark size={132} loading />                    while something is fetching
//   <CollieMark size={40} weight="header" />             below about 80px
//
// The component keeps upstream's name and props so the hosts (header, splash, idle lock, tour) and
// their tests stay as they are. What they read is unchanged: `cm-live` on the root while loading,
// and the per-instance CSS custom properties on the element.
//
// LOADING IS A COLOUR AS WELL AS A MOVE. The head trots (a short hop) and its outline takes the
// accent colour. Under `prefers-reduced-motion` the hop stops and the colour still says "working".
//
// The outline is drawn on every weight: the head is dark brown, and without it a dark page swallows
// the silhouette.

import type { CSSProperties } from "react";

import { GADDI_HEAD, GADDI_OUTLINE, GADDI_VIEW } from "./gaddi-mark-art";

// A <style> inside an inline SVG is document-scoped, so the rules are shared by every instance and
// everything that varies per instance is a custom property on the element.
const STYLE =
  "@keyframes gm-trot{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}" +
  ".cm-live .gm-head{animation:gm-trot .45s steps(2) infinite}" +
  ".gm-line{fill:var(--cm-a1)}" +
  "@media (prefers-reduced-motion:reduce){.cm-live .gm-head{animation:none}}";

const vars = (loading: boolean, paper: string): CSSProperties => {
  const set = {
    "--cm-a1": loading ? "oklch(0.8 0.17 75)" : "oklch(0.95 0.05 85)",
    "--cm-paper": paper,
  };
  // SAFETY: every key is a CSS custom property and every value is a string. React passes unknown
  // style keys straight through to the DOM, so they are used exactly as written. The cast exists
  // only because CSSProperties has no index signature for `--*`; it widens nothing.
  return set as CSSProperties;
};

const BODY = { __html: `<g class="gm-line">${GADDI_OUTLINE}</g><g class="gm-head">${GADDI_HEAD}</g>` };

export interface CollieMarkProps {
  /** Rendered width and height, in pixels. */
  size?: number;
  /** While something is fetching: the head trots and its outline takes the accent colour. */
  loading?: boolean;
  /**
   * Whatever the mark is sitting on. The pixel head has no knockout, so nothing paints with it; it
   * is kept on the element because the hosts still name their surface through it.
   */
  paper?: string;
  /** An accessible name. Without one the mark is decorative and hidden from assistive tech. */
  title?: string;
  /** Forwarded to the element. The mark is often muted or dimmed by its host. */
  className?: string;
  /** Kept for the hosts' call sites: the pixel head reads the same at every size. */
  weight?: "full" | "header";
}

export function CollieMark({
  size = 32,
  loading = false,
  paper = "var(--background)",
  title,
  className,
}: CollieMarkProps) {
  const live = loading ? "cm-live" : "";
  const classes = className === undefined ? live || undefined : (live + " " + className).trim();
  return (
    <svg
      width={size}
      height={size}
      className={classes}
      viewBox={GADDI_VIEW}
      shapeRendering="crispEdges"
      role={title === undefined ? "presentation" : "img"}
      aria-label={title}
      style={{ display: "block", flex: "none", ...vars(loading, paper) }}
    >
      <style>{STYLE}</style>
      <g dangerouslySetInnerHTML={BODY} />
    </svg>
  );
}
