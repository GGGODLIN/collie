// The constants module is plain JS. The test imports it so the tool ids are the installed
// package's, not a re-typed copy of the barrel (whose Node entry pulls in Konva's canvas binding).
declare module "react-filerobot-image-editor/lib/utils/constants.js" {
  export const TOOLS_IDS: {
    readonly CROP: string;
    readonly PEN: string;
    readonly ELLIPSE: string;
    readonly ARROW: string;
    readonly TEXT: string;
  };
  export const TABS_IDS: {
    readonly ADJUST: string;
    readonly ANNOTATE: string;
  };
}
