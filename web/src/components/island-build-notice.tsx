import { useState } from "react";
import { Smartphone } from "lucide-react";

import type { IslandApp } from "@/components/island-address-control";
import { Collapse } from "@/components/ui/collapse";
import { CopyableBlock } from "@/components/ui/copyable-block";
import { Notice } from "@/components/ui/notice";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { islandUpdateTag, RECOMMENDED_ISLAND_BUILD, type IslandBuildRecommendation } from "@/lib/island-build";

const DISMISSED_BUILD_KEY = "collie:island-build-dismissed:v1";

interface IslandBuildNoticeProps {
  host?: { collieIsland?: IslandApp };
  recommended?: IslandBuildRecommendation;
  dismissible?: boolean;
  className?: string;
}

function readDismissedBuild(): string | null {
  try {
    return localStorage.getItem(DISMISSED_BUILD_KEY);
  } catch {
    return null;
  }
}

export function IslandBuildNotice({
  host = window,
  recommended = RECOMMENDED_ISLAND_BUILD,
  dismissible = true,
  className,
}: IslandBuildNoticeProps) {
  useLocale();
  const [dismissedBuild, setDismissedBuild] = useState(readDismissedBuild);
  const tag = islandUpdateTag(host.collieIsland, recommended);
  // Settings is the permanent second surface: dismissing the home hint must not lose the remedy.
  const open = tag !== null && (!dismissible || dismissedBuild !== String(recommended.build));
  const dismiss = () => {
    const build = String(recommended.build);
    setDismissedBuild(build);
    try {
      localStorage.setItem(DISMISSED_BUILD_KEY, build);
    } catch {
      // Blocked storage still permits dismissal for this mounted view.
    }
  };
  const url = `https://github.com/GGGODLIN/gaddi/releases/download/${tag}/CollieIsland.ipa`;

  return (
    <Collapse open={open} className={className}>
      {open ? (
        <Notice
          tone="info"
          variant="box"
          icon={<Smartphone />}
          {...(dismissible
            ? { onDismiss: dismiss, dismissLabel: t("islandUpdate.dismiss") }
            : { onDismiss: undefined, dismissLabel: undefined })}
        >
          <div className="space-y-2">
            <p className="font-medium">{t("islandUpdate.title")}</p>
            <p>{t("islandUpdate.download")}</p>
            <CopyableBlock text={url}>
              <code className="block break-all font-mono select-text">{url}</code>
            </CopyableBlock>
            <p>{t("islandUpdate.install")}</p>
            <p className="font-medium">{t("islandUpdate.keepApp")}</p>
          </div>
        </Notice>
      ) : null}
    </Collapse>
  );
}
