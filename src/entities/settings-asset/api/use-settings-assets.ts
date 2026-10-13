"use client";

import { useMemo } from "react";

import { accountMovements } from "@/entities/ledger/lib/balances";
import { useLedger } from "@/entities/ledger/api/use-ledger";
import { useCurrency } from "@/shared/lib/currency/provider";
import { todayIso } from "@/shared/lib/date";
import { useTable } from "@/shared/storage";

import { resolveAssetValues } from "../lib/valuation";
import { SETTINGS_ASSETS_SEED, type SettingsAsset } from "../model";

/**
 * The asset list with today's values: accounts follow the money recorded
 * against them since their balance was last set, and USD and gold holdings
 * follow live rates. Writes go to the stored list; anything written back from
 * this list must come from `stored` (the 4th item) or set `valueAsOf`, or
 * recorded money would count twice.
 */
export function useSettingsAssets() {
  const [stored, setAssets, loaded] = useTable<SettingsAsset[]>("settingsAssets", SETTINGS_ASSETS_SEED);
  const rates = useCurrency()?.rates ?? null;
  const { txns } = useLedger();
  const today = todayIso();
  const movements = useMemo(() => accountMovements(stored, txns, today, rates?.vndPerUsd ?? null), [stored, txns, today, rates?.vndPerUsd]);
  const assets = useMemo(() => resolveAssetValues(stored, rates, movements), [stored, rates, movements]);
  return [assets, setAssets, loaded, stored] as const;
}
