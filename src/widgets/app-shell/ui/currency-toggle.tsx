"use client";

import { toast } from "sonner";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { useCurrency } from "@/shared/lib/currency/provider";
import { Button } from "@/shared/ui/kit/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

/** ₫ / $ button: show every amount in đồng or US dollars (saved with the account). */
export function CurrencyToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const ctx = useCurrency();
  if (!ctx) return null;
  const c = t.currency;
  const label = c.toggle.label({ name: c.names[ctx.display] });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("text-base font-semibold tabular-nums", className)}
          aria-label={label}
          onClick={() => {
            const next = ctx.chosen === "USD" ? "VND" : "USD";
            ctx.updatePrefs((p) => ({ ...p, display: next }));
            if (next === "USD" && !ctx.rates.vndPerUsd) toast(c.toggle.noRate);
            else toast(c.toggle.switched({ name: c.names[next] }));
          }}
        >
          <span key={ctx.display} className="motion-safe:animate-check-pop" aria-hidden>
            {ctx.display === "USD" ? "$" : "₫"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
