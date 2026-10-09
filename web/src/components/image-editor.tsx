import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComponentProps, ComponentType } from "react";
import type FilerobotImageEditor from "react-filerobot-image-editor";

import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/sheet";
import { useLocale } from "@/hooks/use-locale";
import { t as translate } from "@/lib/i18n";
import {
  EDITOR_TABS,
  EDITOR_TOOLS,
  canvasAvailable,
  hiddenToolCss,
  savedImageToFile,
} from "@/lib/image-edit";

// Portaled to `document.body` because the composer sits in a sticky, transformed footer, and a
// BottomSheet mounted there would be trapped by that transform (the same reason the pane menu is
// not mounted inside the composer). BottomSheet is the floating layer. Drag-to-dismiss is off for
// this caller only: Konva listens for touchmove on window, so swallowing the event to keep the
// sheet still would also swallow the stroke.
//
// The editor library is loaded only while this dialog is open. `useBackendTranslations` stays
// false: the default asks i18n-fastly.ultrafast.io and posts missing keys to neo.wordplex.io,
// which the bridge CSP (`connect-src 'self'`) would block and which we do not want attempted.
// Fonts are local family names only. No cloudimage token, no remote font fetch.

type FilerobotProps = ComponentProps<typeof FilerobotImageEditor>;

export interface ImageEditorProps {
  file: File;
  onConfirm: (file: File) => void;
  onCancel: () => void;
  /** The editor cannot run. The parent must not upload. */
  onFail: (reason: "unavailable" | "failed") => void;
  /** A save produced nothing uploadable. The dialog stays so the operator can cancel. */
  onReject: () => void;
}

export function ImageEditor({ file, onConfirm, onCancel, onFail, onReject }: ImageEditorProps) {
  useLocale();
  const titleId = useId();
  const onFailRef = useRef(onFail);
  const onRejectRef = useRef(onReject);
  const onCancelRef = useRef(onCancel);
  const getDataRef = useRef<NonNullable<FilerobotProps["getCurrentImgDataFnRef"]>["current"]>(undefined);
  // Seeded by useRef for the first commit. Later callback identities land here, before the
  // effects below read them, and not during render.
  useEffect(() => {
    onFailRef.current = onFail;
    onRejectRef.current = onReject;
    onCancelRef.current = onCancel;
  }, [onFail, onReject, onCancel]);
  const [url, setUrl] = useState<string | null>(null);
  const [Editor, setEditor] = useState<ComponentType<FilerobotProps> | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!canvasAvailable()) {
      onFailRef.current("unavailable");
      return;
    }
    let objectUrl: string;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      onFailRef.current("failed");
      return;
    }
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    if (!canvasAvailable()) return;
    let live = true;
    void import("react-filerobot-image-editor")
      .then((mod) => {
        if (live) setEditor(() => mod.default);
        return undefined;
      })
      .catch(() => {
        if (!live) return undefined;
        setBroken(true);
        onFailRef.current("failed");
        return undefined;
      });
    return () => {
      live = false;
    };
  }, []);

  function confirm() {
    const read = getDataRef.current;
    if (read === undefined) {
      onRejectRef.current();
      return;
    }
    try {
      const dot = file.name.lastIndexOf(".");
      const name = dot > 0 ? file.name.slice(0, dot) : file.name;
      const result = read({ name, extension: "png", quality: 0.92 });
      const next = savedImageToFile(result.imageData, file.name);
      if (next === null || next.size === 0) {
        onRejectRef.current();
        return;
      }
      onConfirm(next);
    } catch {
      onRejectRef.current();
    }
  }

  const translations = {
    adjustTab: translate("composer.imageEdit.adjust"),
    annotateTabLabel: translate("composer.imageEdit.annotate"),
    cropTool: translate("composer.imageEdit.crop"),
    penTool: translate("composer.imageEdit.pen"),
    ellipseTool: translate("composer.imageEdit.ellipse"),
    arrowTool: translate("composer.imageEdit.arrow"),
    textTool: translate("composer.imageEdit.text"),
    save: translate("composer.imageEdit.confirm"),
    cancel: translate("composer.imageEdit.cancel"),
    confirm: translate("composer.imageEdit.confirm"),
    discardChanges: translate("composer.imageEdit.discard"),
    discardChangesWarningHint: translate("composer.imageEdit.discardHint"),
    warning: translate("composer.imageEdit.discard"),
    changesLoseWarningHint: translate("composer.imageEdit.discardHint"),
    resetOperations: translate("composer.imageEdit.reset"),
    undoTitle: translate("composer.imageEdit.undo"),
    redoTitle: translate("composer.imageEdit.redo"),
    zoomInTitle: translate("composer.imageEdit.zoomIn"),
    zoomOutTitle: translate("composer.imageEdit.zoomOut"),
    loading: translate("composer.imageEdit.loading"),
    invalidImageError: translate("composer.imageEdit.failed"),
  };

  const sheet = (
    <BottomSheet
      open
      dragToDismiss={false}
      onClose={() => onCancelRef.current()}
      title={translate("composer.imageEdit.title")}
      className="max-h-[92dvh]"
    >
      <div className="collie-image-editor">
        <h2 id={titleId} className="sr-only">
          {translate("composer.imageEdit.title")}
        </h2>
        <style>
          {`${hiddenToolCss("div.collie-image-editor")}
.collie-image-editor{display:flex;flex-direction:column;min-height:0;height:min(70dvh,calc(92dvh - 7rem));max-height:calc(92dvh - 7rem)}
.collie-image-editor .image-editor-stage{flex:1 1 auto;min-height:0;overflow:hidden}
.collie-image-editor .image-editor-actions{flex:0 0 auto}
.collie-image-editor .FIE_root,.collie-image-editor .FIE_main-container,.collie-image-editor .FIE_editor-content{height:100% !important;max-height:100% !important;min-height:0 !important;overflow:hidden !important}
.collie-image-editor .FIE_main-container,.collie-image-editor .FIE_editor-content{flex:1 1 auto !important}
.collie-image-editor .FIE_canvas-container{height:auto !important;min-height:0 !important;flex:1 1 auto !important;overflow:hidden !important}
.collie-image-editor .FIE_tools-bar-wrapper,.collie-image-editor .FIE_tools-bar{flex:0 0 auto !important}`}
        </style>
        <div className="image-editor-stage">
          {broken || Editor === null || url === null ? (
            <p className="py-6 text-sm text-muted-foreground">{translate("composer.imageEdit.loading")}</p>
          ) : (
            <Editor
              source={url}
              tabsIds={[EDITOR_TABS.adjust, EDITOR_TABS.annotate]}
              defaultTabId={EDITOR_TABS.adjust}
              defaultToolId={EDITOR_TOOLS.crop}
              onClose={() => onCancelRef.current()}
              useBackendTranslations={false}
              useCloudimage={false}
              avoidChangesNotSavedAlertOnLeave
              closeAfterSave={false}
              removeSaveButton
              savingPixelRatio={1}
              previewPixelRatio={1}
              defaultSavedImageType="png"
              noCrossOrigin
              resetOnImageSourceChange
              observePluginContainerSize
              language="en"
              translations={translations}
              theme={{ typography: { fontFamily: "inherit" } }}
              Text={{ fonts: ["Arial", "sans-serif"], fontFamily: "Arial" }}
              Crop={{ noPresets: true }}
              getCurrentImgDataFnRef={getDataRef}
            />
          )}
        </div>
        <div className="image-editor-actions flex gap-2">
          <Button type="button" variant="outline" size="lg" className="min-h-11 flex-1" onClick={() => onCancelRef.current()}>
            {translate("composer.imageEdit.cancel")}
          </Button>
          <Button
            type="button"
            size="lg"
            className="min-h-11 flex-1"
            disabled={Editor === null || url === null || broken}
            onClick={confirm}
          >
            {translate("composer.imageEdit.confirm")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );

  return createPortal(sheet, document.body);
}
