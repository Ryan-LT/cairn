"use client";

import { CircleHelp, Lightbulb } from "lucide-react";

import type { HelpTopic } from "@/shared/config/help";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/kit/popover";

/**
 * Small "?" beside a heading: what this block means and how its numbers are
 * worked out. Pair it with `data-help={topic}` on the block so "explain this
 * screen" and the tour find it too.
 */
export function HelpHint({ topic, className }: { topic: HelpTopic; className?: string }) {
  const { t } = useI18n();
  const c = t.help.topics[topic];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t.help.ui.whatIs({ name: c.title })}
          // Above stretched card links, and never toggles the card it sits in.
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative z-[2] inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-primary-soft data-[state=open]:text-primary",
            className,
          )}
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" collisionPadding={12} className="grid w-[min(20rem,calc(100vw-1.5rem))] gap-2 rounded-xl">
        <p className="text-sm font-semibold">{c.title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
        {c.tip ? (
          <p className="flex gap-2 rounded-lg bg-primary-soft/60 px-2.5 py-2 text-xs leading-relaxed text-primary-soft-foreground">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{c.tip}</span>
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
