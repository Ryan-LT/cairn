import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";

import { CACHE_SHELL_ROUTES_MESSAGE, SHELL_ROUTES } from "./sw-routes";
import {
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** v2: pages moved into sections (Oct 2026); the old cache held pages that no longer exist. */
const NAV_CACHE = "cairn-pages-v2";
/** Includes the caches from before the app was renamed to Cairn. */
const RETIRED_CACHES = ["cairn-pages", "wealthtracker-pages", "wealthtracker-pages-v2", "wealthtracker-tables", "wealthtracker-finance"];
const OFFLINE_URL = "/offline";

/**
 * Prefer the network for API reads so each app open gets fresh data; fall back
 * to cache only when offline.
 */
const apiCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url: { pathname }, request }) =>
      sameOrigin && request.method === "GET" && pathname === "/api/tables",
    method: "GET",
    handler: new NetworkFirst({
      // Cleared on sign-in / sign-out (`clearTablesResponseCache`): it holds one account's data.
      cacheName: "cairn-tables",
      networkTimeoutSeconds: 10,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 60 * 60 * 24 * 7,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  {
    matcher: ({ sameOrigin, url: { pathname }, request }) =>
      sameOrigin &&
      request.method === "GET" &&
      pathname.startsWith("/api/finance/"),
    method: "GET",
    handler: new NetworkFirst({
      cacheName: "cairn-finance",
      networkTimeoutSeconds: 10,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 60 * 60 * 24,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
];

/**
 * Navigation + RSC caching. Defined BEFORE `defaultCache` in the runtime list so
 * these matchers win. `defaultCache`'s HTML matcher gates on `Content-Type`,
 * which browser navigation requests never set, so it misses real page loads.
 */
const navigationCaching: RuntimeCaching[] = [
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      request.headers.get("RSC") === "1" &&
      request.headers.get("Next-Router-Prefetch") === "1",
    // Network first: a cached payload from an older deploy would force a full reload.
    handler: new NetworkFirst({
      cacheName: "pages-rsc-prefetch",
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 }),
      ],
    }),
  },
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      request.headers.get("RSC") === "1",
    handler: new NetworkFirst({
      cacheName: "pages-rsc",
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 }),
      ],
    }),
  },
  {
    matcher: ({ request, sameOrigin, url: { pathname } }) =>
      sameOrigin &&
      request.mode === "navigate" &&
      !pathname.startsWith("/api/"),
    handler: new NetworkFirst({
      cacheName: NAV_CACHE,
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 }),
      ],
    }),
  },
];

async function cacheShellRoutes({ onlyMissing }: { onlyMissing: boolean }): Promise<void> {
  const cache = await caches.open(NAV_CACHE);
  await Promise.allSettled(
    SHELL_ROUTES.map(async (url) => {
      if (onlyMissing && (await cache.match(url))) return;
      const res = await fetch(url, { credentials: "same-origin", cache: "reload" });
      // Never cache a login redirect (signed-out install) as the page itself.
      if (res.ok && !res.redirected) await cache.put(url, res);
    }),
  );
}

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.allSettled(RETIRED_CACHES.map((name) => caches.delete(name))));
});

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShellRoutes({ onlyMissing: false }));
});

// A first install usually happens on /login, before sign-in, so the pass above
// stores nothing; the signed-in shell asks again to fill the gaps.
self.addEventListener("message", (event) => {
  if (event.data?.type === CACHE_SHELL_ROUTES_MESSAGE) {
    event.waitUntil(cacheShellRoutes({ onlyMissing: true }));
  }
});

const serwist = new Serwist({
  precacheEntries: [
    ...(self.__SW_MANIFEST ?? []),
    { url: OFFLINE_URL, revision: null } as PrecacheEntry,
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...apiCaching, ...navigationCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
