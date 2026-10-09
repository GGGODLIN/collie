import { Copy } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { setStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

interface CopyableBlockProps {
  text: string;
  children: ReactNode;
  label?: string;
  className?: string;
}

export function CopyableBlock({ text, children, label, className }: CopyableBlockProps): ReactNode {
  useLocale();
  const canCopy = !!navigator.clipboard;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t("copyable.done"), "success");
    } catch {
      setStatus(t("copyable.failed"), "error");
    }
  };
  return (
    <div className={cn("min-w-0", className)}>
      {canCopy && (
        <div className="flex justify-end font-sans">
          <Button type="button" variant="ghost" size="lg" className="gap-1.5 px-2 text-xs" onClick={() => void copy()}>
            <Copy aria-hidden className="size-3.5" />
            {label ?? t("copyable.copy")}
          </Button>
        </div>
      )}
      {children}
    </div>
  );
}
