"use client";

import { CircleHelp, Footprints, ScanSearch } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/kit/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";

import { helpSeen, subscribeExplain } from "../model/store";
import { startExplain, startPageTour } from "../model/tour";

/** Top-bar "?" menu: explain this screen, or take its tour. Glows until first used on this device. */
export function HelpMenu({ className }: { className?: string }) {
  const { t } = useI18n();
  const u = t.help.ui;
  // Re-read whenever help starts (that's when it becomes "seen"); the server render assumes seen.
  const seen = useSyncExternalStore(subscribeExplain, helpSeen, () => true);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={u.open} className={cn("relative", className)}>
          <CircleHelp />
          {!seen ? (
            <span aria-hidden className="absolute top-1.5 right-1.5 flex size-2">
              <span className="absolute inset-0 rounded-full bg-primary motion-safe:animate-ping" />
              <span className="relative size-2 rounded-full bg-primary" />
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{u.menuTitle}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => startExplain()} className="items-start gap-3 py-2">
          <ScanSearch className="mt-0.5" />
          <span className="grid gap-0.5">
            <span className="font-medium">{u.explain}</span>
            <span className="text-xs text-muted-foreground">{u.explainHint}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          // After the menu closes, so the tour measures the page without it.
          onSelect={() => setTimeout(startPageTour, 50)}
          className="items-start gap-3 py-2"
        >
          <Footprints className="mt-0.5" />
          <span className="grid gap-0.5">
            <span className="font-medium">{u.tour}</span>
            <span className="text-xs text-muted-foreground">{u.tourHint}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="max-md:hidden" />
        <p className="px-2 py-1.5 text-xs text-muted-foreground max-md:hidden">{u.shortcut}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
