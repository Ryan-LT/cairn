"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { useAppPathname } from "@/shared/lib/use-app-pathname";
import { ALL_ROUTES } from "@/shared/config";
import { isServiceWorkerUpdateReady } from "@/shared/lib/service-worker";

import { endNavigationProgress, isPlainClick, startNavigationProgress } from "../model/navigation";

/**
 * Shell-wide navigation plumbing:
 * - clears the progress bar when the new page renders,
 * - starts it for any other in-app link (cards, breadcrumbs, empty states),
 * - prefetches every page once the app is idle, so all tabs open instantly,
 * - loads a freshly installed app version on the next page change.
 */
export function NavigationEffects() {
  const pathname = useAppPathname();
  const router = useRouter();
  const firstRender = useRef(true);

  useLayoutEffect(() => {
    endNavigationProgress();
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (isServiceWorkerUpdateReady()) window.location.reload();
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isPlainClick(event)) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      startNavigationProgress(url.pathname);
    };
    // Capture phase: runs before <Link> calls preventDefault for its client-side navigation.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const prefetchAll = () => ALL_ROUTES.forEach((href) => router.prefetch(href));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetchAll, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetchAll, 1500);
    return () => clearTimeout(id);
  }, [router]);

  return null;
}
