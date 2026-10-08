import { render, screen } from "@testing-library/react";

import { collieMark, markAccent, markIsLive, markPaper } from "@/test/collie-mark";

import { CollieMark } from "./collie-mark";

// The mark's own contract, as opposed to what any screen does with it.
//
// jsdom has no `Element.prototype.getAnimations`, so none of these tests can ask "is the CSS
// animation actually running". Instead they assert what drives it: the `cm-live` class that the
// stylesheet's `.cm-live .gm-head { animation: … }` rule keys on.
describe("CollieMark", () => {
  it("is still at rest — no cm-live class — and gains it while loading", () => {
    const { container, rerender } = render(<CollieMark />);
    expect(collieMark(container)?.classList.contains("cm-live")).toBe(false);
    expect(markIsLive(container)).toBe(false);
    rerender(<CollieMark loading />);
    expect(collieMark(container)?.classList.contains("cm-live")).toBe(true);
    expect(markIsLive(container)).toBe(true);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("blooms in COLOUR too, not only by moving", () => {
    // Under `prefers-reduced-motion` the trot stops dead (see below), so if the outline did not also
    // take the accent colour, `loading` would say nothing at all to a reduced-motion reader.
    const { container, rerender } = render(<CollieMark />);
    const resting = markAccent(container);
    expect(resting).not.toBe("");
    rerender(<CollieMark loading />);
    expect(markAccent(container)).not.toBe(resting);
  });

  it("forwards className to the element, so a host can mute or size the mark", () => {
    const { container } = render(<CollieMark className="opacity-40 grayscale" />);
    expect(collieMark(container)?.getAttribute("class")).toBe("opacity-40 grayscale");
  });

  it("keeps the caller's paper on the element, never the built-in default", () => {
    const { container } = render(<CollieMark paper="var(--muted)" />);
    expect(markPaper(container)).toBe("var(--muted)");
  });

  it("carries every per-instance difference on the element, so two marks never fight", () => {
    // A <style> inside an inline SVG is DOCUMENT-scoped: if the rules themselves differed per
    // instance, a resting mark and a blooming one on the same page would overwrite each other.
    const { container } = render(
      <div>
        <CollieMark />
        <CollieMark loading />
      </div>,
    );
    const marks = [...container.querySelectorAll<SVGSVGElement>("svg")];
    expect(marks.map((m) => m.classList.contains("cm-live"))).toStrictEqual([false, true]);
    const sheets = [...container.querySelectorAll("svg > style")].map((s) => s.textContent);
    expect(sheets[0]).toBe(sheets[1]);
  });

  it("is decorative unless given a title, and an image when it has one", () => {
    const { rerender } = render(<CollieMark />);
    expect(screen.queryByRole("img")).toBeNull();
    rerender(<CollieMark title="Gaddi" />);
    expect(screen.getByRole("img", { name: "Gaddi" })).toBeInTheDocument();
  });

  it("stops every moving part under prefers-reduced-motion", () => {
    // It stops the MOTION only: the accent is a variable, not an animation, so the bloom still reads.
    // Checked by deriving the animated selectors, so a moving part added later must be stopped too.
    const { container } = render(<CollieMark loading />);
    const css = collieMark(container)?.querySelector("style")?.textContent ?? "";
    const reduce = /prefers-reduced-motion:reduce\)\{(.*)\}$/.exec(css)?.[1] ?? "";
    const animated = [...css.matchAll(/(\.cm-live [^{]+)\{animation:[^n]/g)].map((m) => m[1]);
    expect(animated.length).toBeGreaterThan(0);
    for (const selector of animated) {
      expect(reduce).toContain(`${selector}{animation:none}`);
    }
  });
});
