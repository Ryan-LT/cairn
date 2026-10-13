import type { Debt } from "@/entities/debt";

import type { ExpensesDoc } from "../model";
import { linkedDebt, monthlyEquivalent } from "./amounts";
import { isEssential, liveItems } from "./breakdown";
import { principalPart } from "./debt-links";

export type SpendingSource =
  /** Nothing entered. */
  | "none"
  /** Only the old single estimate. */
  | "estimate"
  /** Only itemized bills and budgets. */
  | "items"
  /** Items plus what's left of the old estimate. */
  | "mixed";

export type SpendingResolution = {
  /** Monthly money out used by every projection: itemized + unitemized. */
  total: number;
  /** Sum of live items (monthly equivalents). */
  itemized: number;
  /** Total without debt repayments: what life costs once debts are gone (FI number, passive coverage). */
  living: number;
  needs: number;
  wants: number;
  /** Debt repayments among the items (linked to a debt or in the "debt" category). */
  debtPayments: number;
  /** Part of linked debt payments that repays principal (it lowers debt, so net worth doesn't lose it). */
  debtPrincipal: number;
  /** Old estimate not yet broken down into items: max(0, estimate − non-debt items). */
  unitemized: number;
  /** The old single estimate (0 once retired, or if never set). */
  legacyEstimate: number;
  source: SpendingSource;
};

/**
 * Monthly spending from the bill and budget list. Until the old single
 * estimate is retired, whatever it holds beyond the non-debt items still
 * counts, so adding the first bill never makes spending collapse. Debt
 * repayments come on top: the old estimate never included them.
 */
export function resolveMonthlySpending(input: {
  expenses: ExpensesDoc;
  debts: readonly Debt[];
  /** `averageMonthlySpending` from preferences. */
  legacyEstimate: number;
}): SpendingResolution {
  const items = liveItems(input.expenses.items);
  let itemized = 0;
  let needs = 0;
  let wants = 0;
  let debtPayments = 0;
  let debtPrincipal = 0;
  for (const item of items) {
    const debt = linkedDebt(item, input.debts);
    const monthly = monthlyEquivalent(item, debt);
    itemized += monthly;
    if (isEssential(item)) needs += monthly;
    else wants += monthly;
    if (debt || item.category === "debt") debtPayments += monthly;
    if (debt) debtPrincipal += principalPart(debt, monthly);
  }

  const estimate = input.expenses.legacyEstimate?.retiredAt ? 0 : Math.max(0, input.legacyEstimate || 0);
  const unitemized = Math.max(0, estimate - (itemized - debtPayments));
  const total = itemized + unitemized;
  const source: SpendingSource =
    items.length === 0 ? (unitemized > 0 ? "estimate" : "none") : unitemized > 0 ? "mixed" : "items";

  return {
    total,
    itemized,
    living: total - debtPayments,
    needs,
    wants,
    debtPayments,
    debtPrincipal,
    unitemized,
    legacyEstimate: estimate,
    source,
  };
}
