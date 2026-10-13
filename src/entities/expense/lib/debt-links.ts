import { monthlyInterest, type Debt } from "@/entities/debt";

import type { ExpenseItem } from "../model";

/** Debts with a monthly payment that no bill is linked to yet (offered as "add to spending", never linked silently). */
export function suggestDebtBills(items: readonly ExpenseItem[], debts: readonly Debt[]): Debt[] {
  const linked = new Set(items.filter((i) => !i.archivedAt && i.debtId).map((i) => i.debtId));
  return debts.filter((d) => (d.monthlyPayment ?? 0) > 0 && d.balance > 0 && !linked.has(d.id));
}

/** Live items still linked to a debt that no longer exists. */
export function orphanedLinks(items: readonly ExpenseItem[], debts: readonly Debt[]): ExpenseItem[] {
  const ids = new Set(debts.map((d) => d.id));
  return items.filter((i) => !i.archivedAt && i.debtId && !ids.has(i.debtId));
}

/** The live bill linked to a debt, if any. */
export function billForDebt(items: readonly ExpenseItem[], debtId: string): ExpenseItem | undefined {
  return items.find((i) => !i.archivedAt && i.debtId === debtId);
}

/** Part of a monthly payment that repays principal (the rest is interest), capped at the balance. */
export function principalPart(debt: Debt, payment: number): number {
  return Math.min(Math.max(0, debt.balance), Math.max(0, payment - monthlyInterest(debt)));
}
