"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { FormattingRevision } from "@/shared/i18n";

import { setDisplayCurrency } from "./display";
import { effectiveRates, type Currency, type CurrencyPrefs, type EffectiveRates, type RatesSnapshot } from "./rates";
import { getRatesState, getServerRatesState, loadRates, subscribeRates } from "./store";

const REFRESH_MS = 30 * 60_000;

export type CurrencyContextValue = {
  snapshot: RatesSnapshot | null;
  rates: EffectiveRates;
  prefs: CurrencyPrefs;
  /** What the person picked. */
  chosen: Currency;
  /** What amounts are shown in now (`VND` until a USD rate is known). */
  display: Currency;
  loading: boolean;
  error: boolean;
  refresh: () => void;
  updatePrefs: (fn: (prefs: CurrencyPrefs) => CurrencyPrefs) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/**
 * Rates and the display currency for the app. Sets the formatters' display
 * currency during render (amounts stay VND everywhere else) and re-renders
 * every text reader when it changes.
 */
export function CurrencyProvider({
  prefs,
  onPrefsChange,
  enabled = true,
  children,
}: {
  prefs: CurrencyPrefs | undefined;
  onPrefsChange: (fn: (prefs: CurrencyPrefs) => CurrencyPrefs) => void;
  /** Fetch live rates (off while the page has no data yet). */
  enabled?: boolean;
  children: ReactNode;
}) {
  const state = useSyncExternalStore(subscribeRates, getRatesState, getServerRatesState);
  const p = useMemo(() => prefs ?? {}, [prefs]);
  const rates = useMemo(() => effectiveRates(state.snapshot, p), [state.snapshot, p]);
  const chosen: Currency = p.display === "USD" ? "USD" : "VND";
  const display: Currency = chosen === "USD" && rates.vndPerUsd ? "USD" : "VND";

  useEffect(() => {
    if (!enabled) return;
    void loadRates();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadRates();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadRates();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  // Formatters read this during the render below (like the language).
  setDisplayCurrency({ currency: display, vndPerUsd: rates.vndPerUsd });

  const value = useMemo<CurrencyContextValue>(
    () => ({
      snapshot: state.snapshot,
      rates,
      prefs: p,
      chosen,
      display,
      loading: state.loading,
      error: state.error,
      refresh: () => void loadRates(true),
      updatePrefs: onPrefsChange,
    }),
    [state.snapshot, state.loading, state.error, rates, p, chosen, display, onPrefsChange],
  );

  return (
    <CurrencyContext.Provider value={value}>
      <FormattingRevision revision={display === "USD" ? `USD:${rates.vndPerUsd}` : "VND"}>{children}</FormattingRevision>
    </CurrencyContext.Provider>
  );
}

/** Rates and display currency; `null` outside the app (sign-in pages). */
export function useCurrency(): CurrencyContextValue | null {
  return useContext(CurrencyContext);
}
