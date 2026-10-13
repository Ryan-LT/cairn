import { usdToVnd, type EffectiveRates } from "@/shared/lib/currency/rates";

import type { ExpensesDoc } from "../model";

/** Bills and budgets charged in USD get today's VND amount (the saved one while no rate is known). */
export function resolveExpenseValues(doc: ExpensesDoc, rates: EffectiveRates): ExpensesDoc {
  let changed = false;
  const items = doc.items.map((item) => {
    if (!item.amountUsd) return item;
    const live = usdToVnd(item.amountUsd, rates);
    if (live === null || live === item.amount) return item;
    changed = true;
    return { ...item, amount: live };
  });
  return changed ? { ...doc, items } : doc;
}
