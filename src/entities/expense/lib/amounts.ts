import type { Debt } from "@/entities/debt";
import type { MonthKey } from "@/shared/lib/month";

import type { ExpenseItem } from "../model";
import { occurrencesInMonth } from "./schedule";

function money(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** The linked debt, if the item has one and it still exists. */
export function linkedDebt(item: ExpenseItem, debts: readonly Debt[]): Debt | undefined {
  return item.debtId ? debts.find((d) => d.id === item.debtId) : undefined;
}

/**
 * Amount per occurrence. A linked debt is the single source of truth: its
 * monthly payment wins, and a paid-off debt costs nothing.
 */
export function occurrenceAmount(item: ExpenseItem, debt?: Debt): number {
  if (item.debtId && debt) {
    if (money(debt.balance) <= 0) return 0;
    if (money(debt.monthlyPayment) > 0) return money(debt.monthlyPayment);
  }
  return money(item.amount);
}

/** Average monthly cost, used by every projection (yearly bills spread over 12 months). */
export function monthlyEquivalent(item: ExpenseItem, debt?: Debt): number {
  if (item.paused || item.archivedAt) return 0;
  const amount = occurrenceAmount(item, debt);
  switch (item.frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "quarterly":
      return amount / 3;
    case "semiannual":
      return amount / 6;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

/** What actually falls due in this calendar month (a yearly bill lands in its own month). */
export function plannedForMonth(item: ExpenseItem, monthKey: MonthKey, debt?: Debt): number {
  return occurrencesInMonth(item, monthKey) * occurrenceAmount(item, debt);
}
