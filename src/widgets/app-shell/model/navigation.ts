"use client";

import { useRouter } from "next/navigation";

import { hubOf } from "@/shared/config";
import { useAppPathname } from "@/shared/lib/use-app-pathname";
import { startTransition, useCallback, useOptimistic, useSyncExternalStore, type MouseEvent } from "react";

/*
 * Page-change progress: set when a navigation starts, cleared when the new
 * pathname renders (see NavigationEffects). A safety timeout clears it if a
 * navigation never lands.
 */
let pending = false;
/** Page being opened, once the change has taken long enough to need a skeleton. */
let skeletonPath: string | null = null;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
let skeletonTimer: ReturnType<typeof setTimeout> | null = null;
/** Prefetched pages land well inside this; only slower ones get a skeleton. */
const SKELETON_DELAY_MS = 120;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function startNavigationProgress(targetPath?: string): void {
  pending = true;
  // Switching tabs inside a section keeps the section on screen: no skeleton.
  if (targetPath && typeof window !== "undefined") {
    const from = hubOf(stripLocale(window.location.pathname));
    if (from && from !== "home" && from === hubOf(targetPath)) targetPath = undefined;
  }
  if (safetyTimer) clearTimeout(safetyTimer);
  if (skeletonTimer) clearTimeout(skeletonTimer);
  safetyTimer = setTimeout(endNavigationProgress, 10_000);
  skeletonTimer = targetPath
    ? setTimeout(() => {
        skeletonPath = targetPath;
        emit();
      }, SKELETON_DELAY_MS)
    : null;
  emit();
}

export function endNavigationProgress(): void {
  if (safetyTimer) clearTimeout(safetyTimer);
  if (skeletonTimer) clearTimeout(skeletonTimer);
  safetyTimer = null;
  skeletonTimer = null;
  if (!pending && skeletonPath === null) return;
  pending = false;
  skeletonPath = null;
  emit();
}

function stripLocale(path: string): string {
  return path.replace(/^\/(en|vi)(?=\/|$)/, "") || "/";
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useNavigationPending(): boolean {
  return useSyncExternalStore(subscribe, () => pending, () => false);
}

/**
 * The page to show a skeleton for while a slow page change is in flight, so a
 * tap always responds at once even when the page isn't prefetched yet.
 */
export function useNavigationSkeletonPath(): string | null {
  return useSyncExternalStore(subscribe, () => skeletonPath, () => null);
}

/** Plain left click without modifiers: the app handles it as an in-app navigation. */
export function isPlainClick(event: MouseEvent | globalThis.MouseEvent): boolean {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
}

/**
 * Navigation for nav bars: the tapped item becomes active immediately (before
 * the route has rendered) and the progress bar starts.
 */
export function useOptimisticNavigation() {
  const router = useRouter();
  const pathname = useAppPathname();
  const [activePath, setActivePath] = useOptimistic(pathname);

  const navigate = useCallback(
    (href: string) => {
      const targetPath = href.split(/[?#]/)[0] || "/";
      if (targetPath === pathname) {
        // Same page (e.g. `?new=1` opens a dialog): no page change to wait for.
        if (href !== targetPath) router.push(href, { scroll: false });
        return;
      }
      startNavigationProgress(targetPath);
      startTransition(() => {
        setActivePath(targetPath);
        router.push(href);
      });
    },
    [pathname, router, setActivePath],
  );

  /** `onClick` for a `<Link>`: keeps cmd/ctrl-click (new tab) working. */
  const onLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (event.defaultPrevented || !isPlainClick(event)) return;
      event.preventDefault();
      navigate(href);
    },
    [navigate],
  );

  return { pathname, activePath, navigate, onLinkClick };
}
