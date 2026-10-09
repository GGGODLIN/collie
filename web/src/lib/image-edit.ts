// The phone's half of "edit, then upload". Pure on purpose: the composer decides WHEN a file
// may leave, and these functions only answer whether a canvas exists, whether this file is one
// the editor should see, and whether a save payload is a real image. Nothing here talks to the
// network or to a pane.
//
// Tool and tab ids are the string values of react-filerobot-image-editor@4.9.1 `TOOLS` / `TABS`.
// image-edit.test.ts imports that package and fails if a future install renames them. Hardcoding
// the strings here keeps the editor chunk out of the composer's own bundle.

import { attachmentKind, rejectAttachment } from "@/lib/attachments";
import type { UploadCapability } from "@/lib/types";

export const EDITOR_TOOLS = {
  crop: "Crop",
  pen: "Pen",
  ellipse: "Ellipse",
  arrow: "Arrow",
  text: "Text",
} as const;

export const EDITOR_TABS = {
  adjust: "Adjust",
  annotate: "Annotate",
} as const;

/**
 * Tool buttons the library draws inside Adjust and Annotate that this feature does not offer.
 * Hiding them is local CSS, not a fork of the toolbar: the library has no per-tool allowlist,
 * and those buttons are what mount the drawing handlers, so the bar itself has to stay.
 */
export const HIDDEN_EDITOR_TOOL_CLASSES = [
  "FIE_rotate-tool-button",
  "FIE_flip-x-tool-button",
  "FIE_flip-y-tool-button",
  "FIE_image-tool-button",
  "FIE_rect-tool-button",
  "FIE_polygon-tool-button",
  "FIE_line-tool-button",
] as const;

/** The pane an edit was opened against. A confirm for a different pair must not upload. */
export interface EditTarget {
  paneId: string;
  scopeId: string;
}

export function sameEditTarget(open: EditTarget, current: EditTarget): boolean {
  return open.paneId === current.paneId && open.scopeId === current.scopeId;
}

/**
 * Whether this browser can host the editor. A missing 2D context is the failure, not a guess
 * about the user agent: jsdom and a locked-down webview both land here, and the composer then
 * says so instead of uploading the original or pretending the edit worked.
 */
export function canvasAvailable(): boolean {
  try {
    return document.createElement("canvas").getContext("2d") !== null;
  } catch {
    return false;
  }
}

/** An image the bridge would accept, and only then. A refusal still belongs to `rejectAttachment`. */
export function isEditableImage(file: File, limits: UploadCapability): boolean {
  return attachmentKind(file, limits) === "image" && rejectAttachment(file, limits) === null;
}

/**
 * What 4.9.1's save callback actually promises. `imageBase64` and `imageCanvas` are both optional
 * on the type; a payload with neither, or with an empty/undecodable body, is not an image.
 */
export interface SavedImagePayload {
  name?: string;
  extension?: string;
  mimeType?: string;
  fullName?: string;
  imageBase64?: string;
  imageCanvas?: HTMLCanvasElement;
}

const MIME_EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export function extensionForMime(mime: string): string | null {
  const key = mime.toLowerCase();
  switch (key) {
    case "image/png":
    case "image/jpeg":
    case "image/jpg":
    case "image/webp":
    case "image/gif":
      return MIME_EXTENSION[key];
    default:
      return null;
  }
}

/** Keep the operator's file stem and wear the extension the bytes actually are. */
export function fileNameForMime(originalName: string, mime: string): string {
  const ext = extensionForMime(mime);
  if (ext === null) return originalName;
  const slash = Math.max(originalName.lastIndexOf("/"), originalName.lastIndexOf("\\"));
  const base = slash >= 0 ? originalName.slice(slash + 1) : originalName;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${stem === "" ? "image" : stem}.${ext}`;
}

function usableDataUrl(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "data:,") return null;
  return trimmed;
}

function canvasDataUrl(canvas: HTMLCanvasElement | undefined): string | null {
  if (canvas === undefined || canvas.width === 0 || canvas.height === 0) return null;
  try {
    return usableDataUrl(canvas.toDataURL("image/png"));
  } catch {
    return null;
  }
}

function bytesFromDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (match === null) return null;
  const mime = match[1]?.toLowerCase() ?? "";
  if (!mime.startsWith("image/")) return null;
  if (extensionForMime(mime) === null) return null;
  let binary: string;
  try {
    binary = atob((match[2] ?? "").replace(/\s/g, ""));
  } catch {
    return null;
  }
  if (binary.length === 0) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime, bytes };
}

/**
 * A new File, or null when the save carried nothing we can upload. The original File is never
 * written; callers keep it for the cancel path.
 */
export function savedImageToFile(saved: SavedImagePayload, originalName: string): File | null {
  const dataUrl = usableDataUrl(saved.imageBase64) ?? canvasDataUrl(saved.imageCanvas);
  if (dataUrl === null) return null;
  const parsed = bytesFromDataUrl(dataUrl);
  if (parsed === null) return null;
  // A fresh ArrayBuffer, not the view's `ArrayBufferLike` buffer: the File constructor's
  // BlobPart type does not accept a SharedArrayBuffer.
  const copy = new ArrayBuffer(parsed.bytes.byteLength);
  new Uint8Array(copy).set(parsed.bytes);
  return new File([copy], fileNameForMime(originalName, parsed.mime), { type: parsed.mime });
}

/** Scoped under the editor dialog so the rest of the app never inherits `display: none`. */
export function hiddenToolCss(scope: string): string {
  const selectors = HIDDEN_EDITOR_TOOL_CLASSES.map((name) => `${scope} .${name}`).join(",\n");
  return `${selectors} { display: none !important; }`;
}
