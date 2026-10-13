"use client";

import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/shared/i18n";
import { usePrivacyMode } from "@/shared/lib/privacy";
import { Button } from "@/shared/ui/kit/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

/** Eye button: blur every amount on this device (for public places and screen sharing). */
export function PrivacyToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const [hidden, toggle] = usePrivacyMode();
  const label = hidden ? t.common.privacy.show : t.common.privacy.hide;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label={label}
          aria-pressed={hidden}
          onClick={() => {
            toggle();
            if (!hidden) toast(t.common.privacy.hint);
          }}
        >
          {hidden ? <EyeOff /> : <Eye />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
