import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BottomSheet } from "@/components/ui/sheet";

import { ImageEditor } from "./image-editor";

vi.mock("react-filerobot-image-editor", () => ({
  default: () => (
    <div className="FIE_root" data-phone="true">
      <div className="FIE_main-container">
        <div className="FIE_editor-content">
          <div className="FIE_canvas-container" />
          <div className="FIE_tools-bar-wrapper">
            <div className="FIE_tools-bar" />
          </div>
        </div>
      </div>
    </div>
  ),
}));

// A real touch, not React's delegated one. The sheet reads `touches` off the native event.
function pull(target: Element, fromY: number, toY: number) {
  for (const [type, clientY] of [
    ["touchstart", fromY],
    ["touchmove", toY],
  ] as const) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: [{ clientY }] });
    target.dispatchEvent(event);
  }
}

function panelOf(dialog: HTMLElement) {
  // The backdrop button is also tabindex=-1 and comes first. The panel is the scrolling div.
  const panel = dialog.querySelector<HTMLElement>("div.overflow-y-auto");
  if (panel === null) throw new Error("sheet panel missing");
  return panel;
}

describe("ImageEditor sheet shell", () => {
  it("keeps the editor frame inside this sheet and leaves the same classes alone outside it", async () => {
    render(
      <>
        <style>
          {".FIE_root{min-height:250px;overflow:auto;height:100%}.FIE_canvas-container{min-height:250px;flex-grow:1}"}
        </style>
        <div className="FIE_root" data-slot="outside-root" />
        <div className="FIE_canvas-container" data-slot="outside-canvas" />
        <ImageEditor file={new File(["x"], "shot.png", { type: "image/png" })} onConfirm={vi.fn()} onCancel={vi.fn()} onFail={vi.fn()} onReject={vi.fn()} />
      </>,
    );
    await waitFor(() => {
      expect(document.querySelector(".collie-image-editor .FIE_root")).not.toBeNull();
    });
    const insideRoot = document.querySelector(".collie-image-editor .FIE_root");
    const insideCanvas = document.querySelector(".collie-image-editor .FIE_canvas-container");
    const actions = document.querySelector(".collie-image-editor .image-editor-actions");
    if (insideRoot === null || insideCanvas === null || actions === null) {
      throw new Error("editor frame missing");
    }
    const root = getComputedStyle(insideRoot);
    const canvas = getComputedStyle(insideCanvas);
    expect(root.minHeight).toBe("0px");
    expect(root.overflow).toBe("hidden");
    expect(root.maxHeight).toBe("100%");
    expect(canvas.minHeight).toBe("0px");
    expect(canvas.flexGrow).toBe("1");
    expect(getComputedStyle(actions).flexShrink).toBe("0");
    expect(getComputedStyle(document.querySelector("[data-slot='outside-root']")!).minHeight).toBe("250px");
    expect(getComputedStyle(document.querySelector("[data-slot='outside-canvas']")!).minHeight).toBe("250px");
  });

  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:editor");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    // SAFETY: canvasAvailable only checks non-null. This value is never drawn on.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports a missing canvas on the first commit, and Cancel uses the latest callback", () => {
    const onFail = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const failed = render(
      <ImageEditor file={new File(["x"], "shot.png", { type: "image/png" })} onConfirm={vi.fn()} onCancel={vi.fn()} onFail={onFail} onReject={vi.fn()} />,
    );
    expect(onFail).toHaveBeenCalledWith("unavailable");
    failed.unmount();

    // SAFETY: canvasAvailable only checks non-null. This value is never drawn on.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
    const first = vi.fn();
    const second = vi.fn();
    const file = new File(["x"], "shot.png", { type: "image/png" });
    const { rerender } = render(
      <ImageEditor file={file} onConfirm={vi.fn()} onCancel={first} onFail={vi.fn()} onReject={vi.fn()} />,
    );
    rerender(
      <ImageEditor file={file} onConfirm={vi.fn()} onCancel={second} onFail={vi.fn()} onReject={vi.fn()} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]!);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("is a BottomSheet portaled to the body, not a second dialog element", () => {
    render(
      <ImageEditor file={new File(["x"], "shot.png", { type: "image/png" })} onConfirm={vi.fn()} onCancel={vi.fn()} onFail={vi.fn()} onReject={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit image" });
    expect(dialog.tagName).not.toBe("DIALOG");
    expect(document.body.contains(dialog)).toBe(true);
    expect(document.querySelector("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this image" })).toBeInTheDocument();
  });

  it("a touchmove inside the editor reaches the window and does not drag or close the sheet", () => {
    const onCancel = vi.fn();
    const heard: Event[] = [];
    const hear = (event: Event) => {
      heard.push(event);
    };
    // Same phase Konva uses: bubble on window, not capture (DragAndDrop.js touchmove).
    window.addEventListener("touchmove", hear);
    try {
      render(
        <ImageEditor file={new File(["x"], "shot.png", { type: "image/png" })} onConfirm={vi.fn()} onCancel={onCancel} onFail={vi.fn()} onReject={vi.fn()} />,
      );
      const dialog = screen.getByRole("dialog", { name: "Edit image" });
      const surface = dialog.querySelector(".collie-image-editor");
      if (surface === null) throw new Error("editor surface missing");
      act(() => {
        pull(surface, 10, 120);
      });
      expect(heard).toHaveLength(1);
      expect(panelOf(dialog).style.transform).not.toContain("translateY");
      expect(onCancel).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("touchmove", hear);
    }
  });

  it("a stroke on the editor surface does not drag the sheet, and the same pull on the sheet chrome still does", () => {
    render(
      <ImageEditor file={new File(["x"], "shot.png", { type: "image/png" })} onConfirm={vi.fn()} onCancel={vi.fn()} onFail={vi.fn()} onReject={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit image" });
    const panel = panelOf(dialog);
    const surface = dialog.querySelector(".collie-image-editor");
    if (surface === null) throw new Error("editor surface missing");

    act(() => {
      pull(surface, 10, 80);
    });
    expect(panel.style.transform).not.toContain("translateY");

    const chrome = dialog.querySelector("[data-slot='sheet-title-row']");
    if (chrome === null) throw new Error("sheet chrome missing");
    act(() => {
      pull(chrome, 10, 120);
    });
    expect(panel.style.transform).not.toContain("translateY");
  });

  it("a default BottomSheet still drag-dismisses from its title", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Plain">
        body
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Plain" });
    const chrome = dialog.querySelector("[data-slot='sheet-title-row']");
    if (chrome === null) throw new Error("sheet chrome missing");
    act(() => {
      pull(chrome, 10, 80);
    });
    expect(panelOf(dialog).style.transform).toBe("translateY(70px)");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("React stopPropagation on a child does not keep the sheet from dragging", () => {
    function ReactStop() {
      return (
        <div
          data-slot="react-stop"
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          pen
        </div>
      );
    }
    render(
      <BottomSheet open onClose={vi.fn()} title="React stop">
        <ReactStop />
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "React stop" });
    const target = dialog.querySelector("[data-slot='react-stop']");
    if (target === null) throw new Error("react stop target missing");
    act(() => {
      pull(target, 10, 80);
    });
    expect(panelOf(dialog).style.transform).toBe("translateY(70px)");
  });
});
