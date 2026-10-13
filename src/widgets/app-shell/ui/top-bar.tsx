"use client";

import { ChevronRight, Search } from "lucide-react";

import { PrivacyToggle } from "@/features/privacy-mode";
import { useAppPathname } from "@/shared/lib/use-app-pathname";
import { useI18n } from "@/shared/i18n";
import { findNavItem } from "@/shared/config";
import { Button } from "@/shared/ui/kit/button";
import { Separator } from "@/shared/ui/kit/separator";
import { SidebarTrigger } from "@/shared/ui/kit/sidebar";

import { useShell } from "../model/shell-context";
import { NavigationProgress } from "./navigation-progress";
import { OfflineStrip } from "./offline-strip";
import { ThemeToggle } from "./theme-toggle";

export function TopBar() {
  const pathname = useAppPathname();
  const { t } = useI18n();
  const match = findNavItem(pathname);
  const { setCommandOpen } = useShell();

  return (
    <header className="relative z-30 shrink-0 border-b bg-background pt-[env(safe-area-inset-top)] md:rounded-t-xl">
      <OfflineStrip />
      <div className="flex h-14 items-center gap-2 px-3 md:px-4">
        <SidebarTrigger className="size-9" />
        <Separator orientation="vertical" className="mx-1 hidden data-[orientation=vertical]:h-5 md:block" />
        <nav aria-label={t.shell.breadcrumb} className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            {match ? (
              <>
                <li className="hidden text-muted-foreground md:block">{t.nav.groups[match.group.id]}</li>
                <li aria-hidden className="hidden text-muted-foreground md:block">
                  <ChevronRight className="size-3.5" />
                </li>
                <li className="truncate font-semibold md:font-medium" aria-current="page">
                  {t.nav.items[match.item.id].label}
                </li>
              </>
            ) : null}
          </ol>
        </nav>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            onClick={() => setCommandOpen(true)}
            className="hidden h-8 w-56 justify-start gap-2 px-2.5 font-normal text-muted-foreground md:flex"
          >
            <Search />
            {t.shell.searchOrJump}
            <kbd className="ml-auto rounded border bg-muted px-1.5 text-xs font-medium text-muted-foreground">⌘K</kbd>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={t.common.search} onClick={() => setCommandOpen(true)}>
            <Search />
          </Button>
          <PrivacyToggle />
          <ThemeToggle />
        </div>
      </div>
      <NavigationProgress />
    </header>
  );
}
