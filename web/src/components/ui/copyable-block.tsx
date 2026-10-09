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
  const copyLabel = label ?? t("copyable.copy");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t("copyable.done"), "success");
    } catch {
      setStatus(t("copyable.failed"), "error");
    }
  };
  return (
    // Keep the entire scroll viewport outside the 44px tap gutter, so even its last column stays readable.
    <div className={cn("relative min-w-0", canCopy && "min-h-11 pr-12", className)}>
      {canCopy && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={copyLabel}
          title={copyLabel}
          // The 24px face has a 22px padding box; an 11px reach makes 44px and stays inside the block.
          className="absolute top-2.5 right-2.5 size-6 bg-card text-card-foreground before:absolute before:-inset-[11px] before:content-['']"
          onClick={() => void copy()}
        >
          <Copy aria-hidden className="size-3.5" />
        </Button>
      )}
      {children}
    </div>
  );
}
