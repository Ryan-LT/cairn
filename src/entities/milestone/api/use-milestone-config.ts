"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { MilestoneConfigResponse } from "@/entities/milestone/model";
import { onAppForeground } from "@/shared/lib/app-foreground";
import { useCurrency } from "@/shared/lib/currency/provider";

const CACHE_KEY = "wealthtracker:milestone-config:v2";
/** v1 also held the single owner's birthday deadline; dropped on first read. */
const LEGACY_CACHE_KEY = "wealthtracker:milestone-config:v1";
let memoryCache: MilestoneConfigResponse | null = null;

function readCache(): MilestoneConfigResponse | null {
  if (memoryCache) return memoryCache;
  try {
    window.localStorage.removeItem(LEGACY_CACHE_KEY);
    const raw = window.localStorage.getItem(CACHE_KEY);
    memoryCache = raw ? (JSON.parse(raw) as MilestoneConfigResponse) : null;
  } catch {
    memoryCache = null;
  }
  return memoryCache;
}

function writeCache(data: MilestoneConfigResponse): void {
  memoryCache = data;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the in-memory copy still serves this session.
  }
}

/**
 * Loads `/api/finance/milestone-35-config`, showing the last known copy right
 * away and refreshing it in the background (also when the app returns to the
 * foreground). An error is only reported when there is nothing to show.
 */
export function useMilestoneConfig(): {
  config: MilestoneConfigResponse | null;
  error: string | null;
  reload: () => void;
} {
  // Pages render on the client only (behind the app's data gate), so reading storage here is safe.
  const [config, setConfig] = useState<MilestoneConfigResponse | null>(readCache);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/finance/milestone-35-config", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as MilestoneConfigResponse;
        writeCache(data);
        if (!cancelled) {
          setConfig(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled && !memoryCache) setError(e instanceof Error ? e.message : "Could not load milestone settings");
      }
    };
    void load();
    const off = onAppForeground(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  // One USD rate across the app: the live one (or the person's own) from the currency settings.
  const rate = useCurrency()?.rates.vndPerUsd ?? null;
  const merged = useMemo(() => (config && rate ? { ...config, vndPerUsd: rate } : config), [config, rate]);
  return { config: merged, error: merged ? null : error, reload };
}
