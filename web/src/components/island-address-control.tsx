import { Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

// What Collie Island (ios/) injects into this page: ios/CollieIsland/IslandAddress.swift defines
// `window.collieIsland`. Absent in a browser and in the installed PWA.
export interface IslandApp {
  build?: number;
  openAddress(): void;
}

declare global {
  interface Window {
    collieIsland?: IslandApp;
  }
}

// The page only asks the app to open its own address screen. It never hands over an address:
// anything running in this page could otherwise point the app at another server, so the new
// address is always one the operator typed into the native screen, which tests it before saving.
//
// Renders nothing outside the app, so a browser never shows a row it cannot act on.
export function IslandAddressControl({ host = window }: { host?: { collieIsland?: IslandApp } }) {
  useLocale();
  const app = host.collieIsland;
  if (!app) return null;

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-medium">{t("settings.islandAddress.title")}</div>
            <p className="text-sm text-muted-foreground">{t("settings.islandAddress.description")}</p>
          </div>
        </div>
        <Button type="button" variant="outline" className="min-h-11 shrink-0 px-4" onClick={() => app.openAddress()}>
          {t("settings.islandAddress.button")}
        </Button>
      </div>
    </Card>
  );
}
