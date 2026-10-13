import type { Debt } from "@/entities/debt";
import type { MonthKey } from "@/shared/lib/month";

import type { ExpenseCategoryId, ExpenseKind, ExpenseLogDoc, ExpensesDoc } from "../model";
import { buildMonthView, type BillStatus, type BudgetStatus } from "./month";

export type ExpenseRecord = {
  monthKey: MonthKey;
  /** Payment date, else due date, else empty. */
  date: string;
  name: string;
  category: ExpenseCategoryId;
  kind: ExpenseKind;
  planned: number;
  actual: number;
  status: BillStatus | BudgetStatus;
  note: string;
};

/** One record per bill / budget per month (oldest month first): the data behind the spending CSV export. */
export function expenseRecords(input: {
  expenses: ExpensesDoc;
  log: ExpenseLogDoc;
  debts: readonly Debt[];
  monthKeys: readonly MonthKey[];
  today: Date;
}): ExpenseRecord[] {
  const out: ExpenseRecord[] = [];
  for (const monthKey of input.monthKeys) {
    const view = buildMonthView({ ...input, monthKey });
    for (const line of view.lines) {
      out.push({
        monthKey,
        date: line.kind === "bill" ? (line.payments.at(-1)?.date ?? line.dueDates[0] ?? "") : "",
        name: line.item.name,
        category: line.item.category,
        kind: line.item.kind,
        planned: Math.round(line.planned),
        actual: Math.round(line.kind === "bill" ? line.settled : line.spent),
        status: line.status,
        note: line.item.note ?? "",
      });
    }
  }
  return out;
}
