import { holdingValueVnd } from "@/shared/lib/currency/holding";
import type { EffectiveRates } from "@/shared/lib/currency/rates";

import type { SettingsAsset } from "../model";

/**
 * Assets with today's value: money recorded against an account since its
 * balance was last set moves it (`movements`, in the account's unit), and
 * those held in USD or gold are revalued at the live rate (without a rate
 * they keep the value saved last time). Returns the same array when nothing
 * changes (so memoized readers don't re-render).
 */
export function resolveAssetValues(assets: SettingsAsset[], rates: EffectiveRates | null, movements?: ReadonlyMap<string, number>): SettingsAsset[] {
  let changed = false;
  const out = assets.map((a) => {
    const moved = movements?.get(a.id) ?? 0;
    if (!a.holding) {
      if (!moved) return a;
      changed = true;
      return { ...a, currentValue: Math.round(a.currentValue + moved) };
    }
    const holding = moved && a.holding.kind === "usd" ? { ...a.holding, amount: Math.round((a.holding.amount + moved) * 100) / 100 } : a.holding;
    const live = rates ? holdingValueVnd(holding, rates) : null;
    if (holding === a.holding && (live === null || live === a.currentValue)) return a;
    changed = true;
    return { ...a, holding, currentValue: live ?? a.currentValue };
  });
  return changed ? out : assets;
}
