"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { messagesFor, setActiveLocale } from "./active";
import type { Locale } from "./locale";
import { en, type Messages } from "./messages/en";

type I18nValue = {
  locale: Locale;
  t: Messages;
  /** Changes when formatting changes without a reload (display currency); see {@link FormattingRevision}. */
  revision?: string;
};

const I18nContext = createContext<I18nValue>({ locale: "en", t: en });

/**
 * Provides the page's language. It is fixed for a page load (each language is
 * its own prerendered page; switching reloads), so code outside React reads
 * it from `activeMessages()` / the formatters.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  setActiveLocale(locale);
  return <I18nContext.Provider value={{ locale, t: messagesFor(locale) }}>{children}</I18nContext.Provider>;
}

/** `{ locale, t }`: `t.goals.title`, `t.common.months({ count })`. */
export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/**
 * Re-renders everything that formats text (every `useI18n` reader) when the
 * formatters' settings change in place, e.g. the display currency.
 */
export function FormattingRevision({ revision, children }: { revision: string; children: ReactNode }) {
  const outer = useContext(I18nContext);
  const value = useMemo(() => ({ ...outer, revision }), [outer, revision]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
