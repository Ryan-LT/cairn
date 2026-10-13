import { holdingValueVnd } from "@/shared/lib/currency/holding";
import type { EffectiveRates } from "@/shared/lib/currency/rates";

import type { SettingsAsset } from "../model";

/**
 * Assets with today's value: those held in USD or gold are revalued at the
 * live rate; without a rate they keep the value saved last time. Returns the
 * same array when nothing changes (so memoized readers don't re-render).
 */
export function resolveAssetValues(assets: SettingsAsset[], rates: EffectiveRates): SettingsAsset[] {
  let changed = false;
  const out = assets.map((a) => {
    if (!a.holding) return a;
    const live = holdingValueVnd(a.holding, rates);
    if (live === null || live === a.currentValue) return a;
    changed = true;
    return { ...a, currentValue: live };
  });
  return changed ? out : assets;
}
