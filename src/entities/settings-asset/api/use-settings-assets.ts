"use client";

import { useMemo } from "react";

import { useCurrency } from "@/shared/lib/currency/provider";
import { useTable } from "@/shared/storage";

import { resolveAssetValues } from "../lib/valuation";
import { SETTINGS_ASSETS_SEED, type SettingsAsset } from "../model";

/**
 * The asset list with today's values (USD and gold holdings follow live
 * rates). Writes go to the stored list as before.
 */
export function useSettingsAssets() {
  const [stored, setAssets, loaded] = useTable<SettingsAsset[]>("settingsAssets", SETTINGS_ASSETS_SEED);
  const rates = useCurrency()?.rates;
  const assets = useMemo(() => (rates ? resolveAssetValues(stored, rates) : stored), [stored, rates]);
  return [assets, setAssets, loaded] as const;
}
