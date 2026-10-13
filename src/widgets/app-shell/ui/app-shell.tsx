"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

import { useAppPathname } from "@/shared/lib/use-app-pathname";
import { PREFERENCES_SEED, type Preferences } from "@/entities/preferences";
import { useFollowAccountLanguage } from "@/features/switch-language";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import type { CurrencyPrefs } from "@/shared/lib/currency/rates";
import { CurrencyProvider } from "@/shared/lib/currency/provider";
import { useTable } from "@/shared/storage";
import { SidebarInset, SidebarProvider } from "@/shared/ui/kit/sidebar";

import { retryInitialLoad, useAppDataState, useAppSync, type AppDataState } from "../model/app-data";
import { useNavigationSkeletonPath } from "../model/navigation";
import { ShellProvider } from "../model/shell-context";
import { useNetWorthTracking } from "../model/use-net-worth-tracking";
import { AppErrorScreen } from "./app-error-screen";
import { AppSidebar } from "./app-sidebar";
import { AssistDock } from "./assist-dock";
import { CommandMenu } from "./command-menu";
import { MobileTabBar } from "./mobile-tab-bar";
import { NavigationEffects } from "./navigation-effects";
import { RouteSkeleton } from "./route-skeleton";
import { TopBar } from "./top-bar";

type AppShellProps = {
  authEnabled: boolean;
  children: ReactNode;
};

/**
 * The frame (sidebar, top bar, bottom dock) renders immediately, including in
 * the prerendered HTML. Only the content area waits for data, and it shows the
 * page's skeleton meanwhile, so every area stays reachable.
 */
export function AppShell({ authEnabled, children }: AppShellProps) {
  const [prefs, setPrefs] = useTable<Preferences>("preferences", PREFERENCES_SEED);
  const updateCurrency = useCallback(
    (fn: (c: CurrencyPrefs) => CurrencyPrefs) => setPrefs((p) => ({ ...p, currency: fn(p.currency ?? {}) })),
    [setPrefs],
  );
  return (
    <CurrencyProvider prefs={prefs.currency} onPrefsChange={updateCurrency}>
      <AppShellFrame authEnabled={authEnabled}>{children}</AppShellFrame>
    </CurrencyProvider>
  );
}

function AppShellFrame({ authEnabled, children }: AppShellProps) {
  const dataState = useAppDataState();
  useAppSync(dataState);
  useFollowAccountLanguage();
  useNetWorthTracking();
  const { t } = useI18n();
  const sidebarOpen = useSidebarOpenPreference();

  return (
    <ShellProvider authEnabled={authEnabled}>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpenPreference} data-app-shell className="h-dvh overflow-hidden">
        <a
          href="#main-content"
          className="fixed top-2 left-2 z-[60] -translate-y-16 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:translate-y-0"
        >
          {t.shell.skipToContent}
        </a>
        <AppSidebar />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden md:peer-data-[variant=inset]:border">
          <TopBar />
          <ScrollArea dataState={dataState}>{children}</ScrollArea>
        </SidebarInset>
        <MobileTabBar />
        <AssistDock />
        {/* Reads and edits records, so it waits for real data like the pages. */}
        {dataState === "ready" ? <CommandMenu /> : null}
        <NavigationEffects />
      </SidebarProvider>
    </ShellProvider>
  );
}

/*
 * Desktop sidebar open/closed, as last chosen. The cookie is written by
 * SidebarProvider; the prerendered HTML assumes "open".
 */
const sidebarListeners = new Set<() => void>();
let sidebarOpenOverride: boolean | null = null;

function readSidebarOpen(): boolean {
  if (sidebarOpenOverride !== null) return sidebarOpenOverride;
  return !/(?:^|;\s*)sidebar_state=false(?:;|$)/.test(document.cookie);
}

function setSidebarOpenPreference(open: boolean): void {
  sidebarOpenOverride = open;
  sidebarListeners.forEach((l) => l());
}

function useSidebarOpenPreference(): boolean {
  return useSyncExternalStore(
    (l) => {
      sidebarListeners.add(l);
      return () => {
        sidebarListeners.delete(l);
      };
    },
    readSidebarOpen,
    () => true,
  );
}

/**
 * The only scrolling element in the app. Shows the page, or its skeleton while
 * data or a slow page change is on the way. New pages start at the top;
 * back/forward restores the previous position.
 */
function ScrollArea({ dataState, children }: { dataState: AppDataState; children: ReactNode }) {
  const pathname = useAppPathname();
  const skeletonPath = useNavigationSkeletonPath();
  const ref = useRef<HTMLElement>(null);
  const positions = useRef(new Map<string, number>());
  const currentPath = useRef(pathname);
  const traversing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => positions.current.set(currentPath.current, el.scrollTop);
    // Covers a back/forward whose route renders after the event; expires so a
    // later normal navigation still starts at the top.
    let clear: ReturnType<typeof setTimeout> | undefined;
    const onPopState = () => {
      traversing.current = true;
      clearTimeout(clear);
      clear = setTimeout(() => (traversing.current = false), 1000);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPopState);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState);
      clearTimeout(clear);
    };
  }, []);

  useLayoutEffect(() => {
    if (currentPath.current === pathname) return;
    currentPath.current = pathname;
    const el = ref.current;
    if (!el) return;
    // React commits back/forward navigations synchronously inside the popstate
    // event, before our own listener runs, so check the current event too.
    const isTraversal = traversing.current || window.event?.type === "popstate";
    el.scrollTop = isTraversal ? (positions.current.get(pathname) ?? 0) : 0;
    traversing.current = false;
  }, [pathname]);

  useLayoutEffect(() => {
    if (skeletonPath && ref.current) ref.current.scrollTop = 0;
  }, [skeletonPath]);

  return (
    <main
      ref={ref}
      aria-busy={skeletonPath !== null || dataState === "loading" || undefined}
      // `relative`: absolutely positioned descendants (sr-only text) must be clipped here, or they stretch the frame and it scrolls.
      // Bottom room for the tab bar (phones) and the floating assistant buttons.
      className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable] pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-24"
    >
      {skeletonPath ? <RouteSkeleton pathname={skeletonPath} /> : null}
      {/* Kept mounted (just hidden) while a slow page change is in flight. */}
      <div className={cn("contents", skeletonPath && "hidden")}>
        {dataState === "ready" ? (
          children
        ) : dataState === "loading" ? (
          <RouteSkeleton pathname={pathname} />
        ) : (
          <AppErrorScreen onRetry={retryInitialLoad} />
        )}
      </div>
    </main>
  );
}
