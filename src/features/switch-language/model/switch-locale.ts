"use client";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/shared/i18n/locale";

/** Service-worker caches holding rendered pages (one language each). */
const PAGE_CACHES = ["cairn-pages", "cairn-pages-v2", "wealthtracker-pages", "wealthtracker-pages-v2", "pages-rsc", "pages-rsc-prefetch"];

export function writeLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Load the app in `locale`: remember it on this device, drop cached pages of the
 * other language, and reload (each language is its own prerendered page).
 */
export async function reloadInLocale(locale: Locale): Promise<void> {
  writeLocaleCookie(locale);
  try {
    if (typeof caches !== "undefined") await Promise.all(PAGE_CACHES.map((name) => caches.delete(name)));
  } catch {
    // Cache Storage unavailable — the network copy is fetched anyway.
  }
  window.location.reload();
}
