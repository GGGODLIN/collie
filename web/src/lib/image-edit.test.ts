// The package barrel's Node entry loads `konva/lib/index-node.js`, which requires the native
// `canvas` package this repo does not ship. The browser build (what Vite bundles) reads these
// same constants. Importing them here still executes the installed 4.9.1 module.
import { TABS_IDS, TOOLS_IDS } from "react-filerobot-image-editor/lib/utils/constants.js";

import { uploadLimits } from "@/lib/attachments";
import {
  EDITOR_TABS,
  EDITOR_TOOLS,
  HIDDEN_EDITOR_TOOL_CLASSES,
  canvasAvailable,
  extensionForMime,
  fileNameForMime,
  hiddenToolCss,
  isEditableImage,
  sameEditTarget,
  savedImageToFile,
} from "@/lib/image-edit";

// The installed package, not a stub. 4.9.1's public constants are the ids the editor is configured
// with; if a reinstall renames one, the toolbar would offer a tool the confirm path does not know.
describe("react-filerobot-image-editor@4.9.1 tool contract", () => {
  it("pins the five approved tools and the two tabs that hold them", () => {
    expect(EDITOR_TOOLS.crop).toBe(TOOLS_IDS.CROP);
    expect(EDITOR_TOOLS.pen).toBe(TOOLS_IDS.PEN);
    expect(EDITOR_TOOLS.ellipse).toBe(TOOLS_IDS.ELLIPSE);
    expect(EDITOR_TOOLS.arrow).toBe(TOOLS_IDS.ARROW);
    expect(EDITOR_TOOLS.text).toBe(TOOLS_IDS.TEXT);
    expect(EDITOR_TABS.adjust).toBe(TABS_IDS.ADJUST);
    expect(EDITOR_TABS.annotate).toBe(TABS_IDS.ANNOTATE);
    expect(EDITOR_TOOLS.crop).toBe("Crop");
    expect(EDITOR_TOOLS.pen).toBe("Pen");
  });
});

describe("savedImageToFile", () => {
  const png = `data:image/png;base64,${btoa("png-bytes")}`;

  it("builds a new File from imageBase64 and does not require imageCanvas", () => {
    const file = savedImageToFile({ imageBase64: png, mimeType: "image/png" }, "shot.png");
    expect(file).not.toBeNull();
    expect(file?.type).toBe("image/png");
    expect(file?.name).toBe("shot.png");
    expect(file?.size).toBe("png-bytes".length);
  });

  it("reads a canvas when imageBase64 is missing", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    vi.spyOn(canvas, "toDataURL").mockReturnValue(png);
    const file = savedImageToFile({ imageCanvas: canvas }, "holiday photo");
    expect(file?.name).toBe("holiday photo.png");
    expect(file?.type).toBe("image/png");
    expect(file?.size).toBeGreaterThan(0);
  });

  it("prefers a present imageBase64 over the canvas", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    vi.spyOn(canvas, "toDataURL").mockImplementation(() => {
      throw new Error("canvas should not be read");
    });
    const file = savedImageToFile({ imageBase64: png, imageCanvas: canvas }, "a.png");
    expect(file?.size).toBeGreaterThan(0);
  });

  it("returns null for a missing payload, an empty body, or a non-image", () => {
    expect(savedImageToFile({}, "a.png")).toBeNull();
    expect(savedImageToFile({ imageBase64: "   " }, "a.png")).toBeNull();
    expect(savedImageToFile({ imageBase64: "data:," }, "a.png")).toBeNull();
    expect(savedImageToFile({ imageBase64: "data:image/png;base64," }, "a.png")).toBeNull();
    expect(savedImageToFile({ imageBase64: "data:text/plain;base64,YQ==" }, "a.png")).toBeNull();
    expect(savedImageToFile({ imageBase64: "not a data url" }, "a.png")).toBeNull();
    const empty = document.createElement("canvas");
    empty.width = 0;
    empty.height = 0;
    expect(savedImageToFile({ imageCanvas: empty }, "a.png")).toBeNull();
  });

  it("returns null when the canvas refuses to encode, and leaves the original File alone", async () => {
    const original = new File([Uint8Array.from([1, 2, 3, 4])], "keep.png", { type: "image/png" });
    const before = Array.from(new Uint8Array(await original.arrayBuffer()));
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    vi.spyOn(canvas, "toDataURL").mockImplementation(() => {
      throw new Error("tainted");
    });
    expect(savedImageToFile({ imageCanvas: canvas }, original.name)).toBeNull();
    expect(Array.from(new Uint8Array(await original.arrayBuffer()))).toEqual(before);
    expect(original.size).toBe(4);
  });

  it("renames a gif stem to the png the canvas actually produced", () => {
    expect(fileNameForMime("clip.gif", "image/png")).toBe("clip.png");
    expect(fileNameForMime("noext", "image/jpeg")).toBe("noext.jpg");
    expect(extensionForMime("image/webp")).toBe("webp");
    expect(extensionForMime("image/svg+xml")).toBeNull();
  });
});

describe("isEditableImage / canvas / target", () => {
  const limits = uploadLimits({ maxBytes: 1024, imageTypes: ["png", "jpg"], textTypes: ["md"] });

  it("accepts a browser image and refuses a text file or an oversize image", () => {
    expect(isEditableImage(new File(["x"], "a.png", { type: "image/png" }), limits)).toBe(true);
    expect(isEditableImage(new File(["#"], "a.md", { type: "text/markdown" }), limits)).toBe(false);
    expect(isEditableImage(new File([new Uint8Array(1025)], "big.png", { type: "image/png" }), limits)).toBe(false);
  });

  it("treats two panes, or two scopes of one pane, as different edit targets", () => {
    const open = { paneId: "w1:p1", scopeId: "lead" };
    expect(sameEditTarget(open, { paneId: "w1:p1", scopeId: "lead" })).toBe(true);
    expect(sameEditTarget(open, { paneId: "w1:p2", scopeId: "lead" })).toBe(false);
    expect(sameEditTarget(open, { paneId: "w1:p1", scopeId: "other" })).toBe(false);
  });

  it("hides only the tools this feature does not offer", () => {
    const css = hiddenToolCss("dialog.collie-image-editor");
    for (const name of HIDDEN_EDITOR_TOOL_CLASSES) {
      expect(css).toContain(`dialog.collie-image-editor .${name}`);
    }
    expect(css).not.toContain("FIE_pen-tool-button");
    expect(css).not.toContain("FIE_crop-tool");
    expect(HIDDEN_EDITOR_TOOL_CLASSES).toHaveLength(7);
  });

  it("reports a canvas only when getContext returns one", () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(canvasAvailable()).toBe(false);
    // SAFETY: canvasAvailable only checks that the return is non-null. Nothing draws with this value.
    spy.mockReturnValue({} as CanvasRenderingContext2D);
    expect(canvasAvailable()).toBe(true);
    spy.mockRestore();
  });
});
