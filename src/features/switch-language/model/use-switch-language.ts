"use client";

import "@/shared/lib/legacy-storage";
import { useCallback, useEffect, useState } from "react";

import { PREFERENCES_SEED } from "@/entities/preferences";
import { useI18n, type Locale } from "@/shared/i18n";
import { readSessionUser } from "@/shared/lib/session-user";
import { flushTablesNow, useInitialLoadDone, useTable } from "@/shared/storage";

import { reloadInLocale } from "./switch-locale";

/**
 * Set while a switch made on this device is saving: the account then already
 * says the new language, and following it would reload before the save lands.
 */
let switchingHere = false;

/** Change language: saved on this device and, when signed in, in the account. */
export function useSwitchLanguage() {
  const { locale } = useI18n();
  const [, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  const [pending, setPending] = useState(false);

  const switchTo = useCallback(
    async (next: Locale) => {
      if (next === locale) return;
      setPending(true);
      switchingHere = true;
      if (readSessionUser()) {
        setPrefs((p) => ({ ...p, locale: next }));
        await flushTablesNow().catch(() => false);
      }
      await reloadInLocale(next);
    },
    [locale, setPrefs],
  );

  return { locale, switchTo, pending };
}

/** Same as {@link useSwitchLanguage} for pages without account data (sign-in, sign-up). */
export function useSwitchLanguageSignedOut() {
  const { locale } = useI18n();
  const switchTo = useCallback(
    async (next: Locale) => {
      if (next !== locale) await reloadInLocale(next);
    },
    [locale],
  );
  return { locale, switchTo, pending: false };
}

const SYNC_GUARD = "cairn:locale-sync";

/**
 * Keep the account and this device on the same language:
 * - an account without a saved language gets the one in use now (Vietnamese
 *   unless the person picked another), so it follows them to other devices;
 * - when the account's language differs from this page's (e.g. chosen on
 *   another device), switch once — guarded so a stuck cookie can't loop.
 */
export function useFollowAccountLanguage() {
  const { locale } = useI18n();
  const [prefs, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  const loaded = useInitialLoadDone();

  useEffect(() => {
    if (!loaded || !readSessionUser()) return;
    if (!prefs.locale) {
      // Only from fresh server data: an offline copy might predate a choice made elsewhere.
      if (navigator.onLine) setPrefs((p) => (p.locale ? p : { ...p, locale }));
      return;
    }
    if (prefs.locale === locale || switchingHere) return;
    try {
      if (sessionStorage.getItem(SYNC_GUARD) === prefs.locale) return;
      sessionStorage.setItem(SYNC_GUARD, prefs.locale);
    } catch {
      // Storage blocked: still switch once per page load.
    }
    void reloadInLocale(prefs.locale);
  }, [loaded, prefs.locale, locale, setPrefs]);
}
