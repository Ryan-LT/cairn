"use client";

import { useState } from "react";

import { cn } from "@/shared/lib/cn";
import { useCurrency } from "@/shared/lib/currency/provider";
import { formatMoney, formatMoneyCompact } from "@/shared/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

export type MoneyTone = "none" | "auto" | "success" | "danger" | "muted";

type MoneyProps = {
  value: number;
  /** Compact form (`4,82B ₫`); hover shows the full value, tap toggles it. */
  compact?: boolean;
  /** Prefix "+" on positive values. */
  signed?: boolean;
  /** `auto` colours positive green and negative red. */
  tone?: MoneyTone;
  strike?: boolean;
  /**
   * Compact values are a small button (hover tooltip, tap to expand). Pass `false`
   * inside other interactive elements (clickable rows, links) to render plain text.
   */
  interactive?: boolean;
  className?: string;
};

export function moneyToneClass(tone: MoneyTone, value: number): string | undefined {
  switch (tone) {
    case "success":
      return "text-success";
    case "danger":
      return "text-danger";
    case "muted":
      return "text-muted-foreground";
    case "auto":
      return value > 0 ? "text-success" : value < 0 ? "text-danger" : undefined;
    default:
      return undefined;
  }
}

/** Every VND amount in the UI goes through this component (shown in the display currency). */
export function Money({ value, compact, signed, tone = "none", strike, interactive = true, className }: MoneyProps) {
  const signDisplay = signed ? "exceptZero" : "auto";
  // Subscribing re-renders amounts when the display currency or rate changes.
  const inUsd = useCurrency()?.display === "USD";
  const full = formatMoney(value, { signDisplay });
  const vnd = inUsd ? formatMoney(value, { signDisplay, currency: "VND" }) : null;
  const [expanded, setExpanded] = useState(false);
  const classes = cn(
    "whitespace-nowrap tabular-nums",
    moneyToneClass(tone, value),
    strike && "line-through decoration-muted-foreground/60",
    className,
  );

  // `data-private`: blurred in privacy mode (see globals.css).
  if (!compact) {
    return (
      <span className={classes} data-private>
        {full}
      </span>
    );
  }

  const short = formatMoneyCompact(value, { signDisplay });
  if (short === full) {
    return (
      <span className={classes} data-private>
        {full}
      </span>
    );
  }

  if (!interactive) {
    return (
      <span className={classes} data-private>
        <span aria-hidden>{short}</span>
        <span className="sr-only">{full}</span>
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={full}
          data-private
          className={cn(classes, "relative z-[1] cursor-help rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring")}
        >
          {expanded ? full : short}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <span data-private>{full}</span>
        {vnd ? (
          <span className="block text-xs opacity-80" data-private>
            {vnd}
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
