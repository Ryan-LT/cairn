import { usdToVnd, type EffectiveRates } from "@/shared/lib/currency/rates";

import type { IncomeSource } from "../model";

/** Sources paid in USD get today's VND monthly amount (the saved one while no rate is known). */
export function resolveIncomeValues(sources: IncomeSource[], rates: EffectiveRates): IncomeSource[] {
  let changed = false;
  const out = sources.map((s) => {
    if (!s.amountUsd) return s;
    const live = usdToVnd(s.amountUsd, rates);
    if (live === null || live === s.monthly) return s;
    changed = true;
    return { ...s, monthly: live };
  });
  return changed ? out : sources;
}
