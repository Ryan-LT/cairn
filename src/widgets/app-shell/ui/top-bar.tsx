"use client";

import { ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";

import { PrivacyToggle } from "@/features/privacy-mode";
import { findNavMatch, QUICK_ADD } from "@/shared/config";
import { useI18n } from "@/shared/i18n";
import { useAppPathname } from "@/shared/lib/use-app-pathname";
import { Button } from "@/shared/ui/kit/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import { Separator } from "@/shared/ui/kit/separator";
import { SidebarTrigger } from "@/shared/ui/kit/sidebar";
import { Logo } from "@/shared/ui/logo";

import { useOptimisticNavigation } from "../model/navigation";
import { useShell } from "../model/shell-context";
import { AccountMenuButton } from "./account-menu";
import { CurrencyToggle } from "./currency-toggle";
import { NavigationProgress } from "./navigation-progress";
import { OfflineStrip } from "./offline-strip";
import { ThemeToggle } from "./theme-toggle";

export function TopBar() {
  const pathname = useAppPathname();
  const { t } = useI18n();
  const match = findNavMatch(pathname);
  const { setCommandOpen } = useShell();
  const { navigate } = useOptimisticNavigation();
  const showTab = match?.tab && match.hub.tabs && match.hub.tabs.length > 1;

  return (
    <header className="relative z-30 shrink-0 border-b bg-background pt-[env(safe-area-inset-top)] md:rounded-t-xl">
      <OfflineStrip />
      <div className="flex h-14 items-center gap-2 px-3 md:px-4">
        <SidebarTrigger className="size-9 max-md:hidden" />
        <Link href="/" aria-label={t.nav.hubs.home.label} className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:hidden">
          <Logo size={28} decorative />
        </Link>
        <Separator orientation="vertical" className="mx-1 hidden data-[orientation=vertical]:h-5 md:block" />
        <nav aria-label={t.shell.breadcrumb} className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            {match ? (
              <>
                <li className="truncate font-semibold md:font-medium" aria-current={showTab ? undefined : "page"}>
                  {t.nav.hubs[match.hub.id].label}
                </li>
                {showTab ? (
                  <>
                    <li aria-hidden className="hidden text-muted-foreground md:block">
                      <ChevronRight className="size-3.5" />
                    </li>
                    <li className="hidden truncate text-muted-foreground md:block" aria-current="page">
                      {t.nav.tabs[match.tab!.id].label}
                    </li>
                  </>
                ) : null}
              </>
            ) : null}
          </ol>
        </nav>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            onClick={() => setCommandOpen(true)}
            className="hidden h-8 w-56 justify-start gap-2 px-2.5 font-normal text-muted-foreground lg:flex"
          >
            <Search />
            {t.shell.searchOrJump}
            <kbd className="ml-auto rounded border bg-muted px-1.5 text-xs font-medium text-muted-foreground">⌘K</kbd>
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t.common.search} onClick={() => setCommandOpen(true)}>
            <Search />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="ml-1 max-md:hidden">
                <Plus />
                {t.shell.quickAddSheet.open}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              {QUICK_ADD.map((a) => (
                <DropdownMenuItem key={a.href} onSelect={() => navigate(a.href)}>
                  <a.icon />
                  {t.nav.quickAdd[a.id].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <CurrencyToggle />
          <PrivacyToggle />
          <ThemeToggle className="max-md:hidden" />
          <div className="ml-1 md:hidden">
            <AccountMenuButton />
          </div>
        </div>
      </div>
      <NavigationProgress />
    </header>
  );
}
