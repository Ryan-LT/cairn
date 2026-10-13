import type { Debt } from "@/entities/debt";
import { monthKeyOf, type MonthKey } from "@/shared/lib/month";

import type { ExpenseCategoryId, ExpenseLogDoc, ExpensesDoc } from "../model";
import { buildMonthView, type MonthLine } from "./month";

export type MonthActual = {
  monthKey: MonthKey;
  planned: number;
  /** Paid, autopaid and spent. */
  actual: number;
  /** Share (0–1) of the month's lines that have a record (or autopay); low coverage means "not tracked", not "cheap". */
  coverage: number;
};

export type ItemDrift = {
  itemId: string;
  name: string;
  category: ExpenseCategoryId;
  /** Current planned amount per occurrence. */
  planned: number;
  /** Average actually paid per paid occurrence. */
  averagePaid: number;
  months: number;
};

export type PlanVsActual = {
  months: MonthActual[];
  /** Averages over finished months tracked at least 70 %. */
  averagePlanned: number | null;
  averageActual: number | null;
  /** Average actual − average planned (positive: spending more than planned). */
  drift: number | null;
  /** Bills paid in at least 2 tracked months whose average differs from the plan by ≥ 10 %. */
  itemDrift: ItemDrift[];
};

/** Months tracked at least this much count toward the averages. */
export const TRACKED_COVERAGE = 0.7;

function isTracked(line: MonthLine): boolean {
  if (line.kind === "budget") return line.spent > 0;
  return line.status === "paid" || line.status === "autopaid" || line.status === "skipped" || line.paid > 0;
}

/** Planned vs actual over the given months (oldest first). The current month is shown but not averaged. */
export function planVsActual(input: {
  expenses: ExpensesDoc;
  log: ExpenseLogDoc;
  debts: readonly Debt[];
  monthKeys: readonly MonthKey[];
  today: Date;
}): PlanVsActual {
  const current = monthKeyOf(input.today);
  const paidByItem = new Map<string, { total: number; count: number; months: number }>();

  const months = input.monthKeys.map((monthKey): MonthActual => {
    const view = buildMonthView({ ...input, monthKey });
    const lines = view.lines.filter((l) => l.kind === "budget" || l.status !== "skipped");
    const coverage = lines.length ? lines.filter(isTracked).length / lines.length : 0;
    if (monthKey < current && coverage >= TRACKED_COVERAGE) {
      for (const line of view.lines) {
        if (line.kind !== "bill" || line.paidCount === 0) continue;
        const p = paidByItem.get(line.item.id) ?? { total: 0, count: 0, months: 0 };
        paidByItem.set(line.item.id, { total: p.total + line.paid, count: p.count + line.paidCount, months: p.months + 1 });
      }
    }
    return { monthKey, planned: view.totals.planned, actual: view.totals.settled, coverage };
  });

  const finished = months.filter((m) => m.monthKey < current && m.coverage >= TRACKED_COVERAGE);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null);
  const averagePlanned = avg(finished.map((m) => m.planned));
  const averageActual = avg(finished.map((m) => m.actual));

  const itemDrift: ItemDrift[] = [];
  for (const item of input.expenses.items) {
    const p = paidByItem.get(item.id);
    if (!p || p.months < 2 || item.archivedAt || item.debtId) continue;
    const averagePaid = p.total / p.count;
    if (item.amount > 0 && Math.abs(averagePaid - item.amount) / item.amount >= 0.1) {
      itemDrift.push({ itemId: item.id, name: item.name, category: item.category, planned: item.amount, averagePaid, months: p.months });
    }
  }
  itemDrift.sort((a, b) => Math.abs(b.averagePaid - b.planned) - Math.abs(a.averagePaid - a.planned));

  return {
    months,
    averagePlanned,
    averageActual,
    drift: averagePlanned !== null && averageActual !== null ? averageActual - averagePlanned : null,
    itemDrift,
  };
}
