import type { Debt } from "@/entities/debt";

import { EXPENSE_CATEGORY_META } from "../config/categories";
import type { ExpenseCategoryId, ExpenseItem } from "../model";
import { linkedDebt, monthlyEquivalent } from "./amounts";

/** Need (true) or want (false): the item's own choice, else its category's default. */
export function isEssential(item: ExpenseItem): boolean {
  return item.essential ?? EXPENSE_CATEGORY_META[item.category]?.essential ?? false;
}

/** Items that count today (not paused or removed). */
export function liveItems(items: readonly ExpenseItem[]): ExpenseItem[] {
  return items.filter((i) => !i.archivedAt && !i.paused);
}

export type CategoryTotal = {
  category: ExpenseCategoryId;
  monthly: number;
  count: number;
  /** Share (0–1) of all itemized monthly spending. */
  share: number;
};

/** Monthly spending per category, largest first. */
export function spendingByCategory(items: readonly ExpenseItem[], debts: readonly Debt[]): CategoryTotal[] {
  const totals = new Map<ExpenseCategoryId, { monthly: number; count: number }>();
  for (const item of liveItems(items)) {
    const monthly = monthlyEquivalent(item, linkedDebt(item, debts));
    const t = totals.get(item.category) ?? { monthly: 0, count: 0 };
    totals.set(item.category, { monthly: t.monthly + monthly, count: t.count + 1 });
  }
  const all = [...totals.values()].reduce((s, t) => s + t.monthly, 0);
  return [...totals.entries()]
    .map(([category, t]) => ({ category, ...t, share: all > 0 ? t.monthly / all : 0 }))
    .sort((a, b) => b.monthly - a.monthly);
}

export type NeedsWantsSplit = {
  needs: number;
  wants: number;
  /** Not itemized yet (the old single estimate): neither need nor want. */
  unclassified: number;
  /** Income − all spending (may be negative). */
  savings: number;
  /** Shares of income (0–1); `null` without income. */
  needsShare: number | null;
  wantsShare: number | null;
  unclassifiedShare: number | null;
  savingsShare: number | null;
};

/** Reference split for the needs / wants / savings bar (50 / 30 / 20 rule of thumb). */
export const NEEDS_WANTS_REFERENCE = { needs: 0.5, wants: 0.3, savings: 0.2 } as const;

export function needsWantsSavings(input: {
  items: readonly ExpenseItem[];
  debts: readonly Debt[];
  income: number;
  unclassified?: number;
}): NeedsWantsSplit {
  let needs = 0;
  let wants = 0;
  for (const item of liveItems(input.items)) {
    const monthly = monthlyEquivalent(item, linkedDebt(item, input.debts));
    if (isEssential(item)) needs += monthly;
    else wants += monthly;
  }
  const unclassified = Math.max(0, input.unclassified ?? 0);
  const savings = input.income - needs - wants - unclassified;
  const share = (v: number) => (input.income > 0 ? v / input.income : null);
  return {
    needs,
    wants,
    unclassified,
    savings,
    needsShare: share(needs),
    wantsShare: share(wants),
    unclassifiedShare: share(unclassified),
    savingsShare: share(savings),
  };
}
