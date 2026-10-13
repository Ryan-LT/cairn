"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import type { Debt } from "@/entities/debt";
import { expenseRecords, type BillStatus, type BudgetStatus, type ExpenseLogDoc, type ExpensesDoc } from "@/entities/expense";
import { useI18n } from "@/shared/i18n";
import { toCsv } from "@/shared/lib/csv";
import { todayIso } from "@/shared/lib/date";
import { downloadText } from "@/shared/lib/download";
import { monthKeyOf, monthsEndingAt } from "@/shared/lib/month";
import { Button } from "@/shared/ui/kit/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Label } from "@/shared/ui/kit/label";
import { SegmentedControl } from "@/shared/ui/segmented-control";

const RANGES = ["3", "6", "12", "36"] as const;

/** Download every bill and budget, month by month, as CSV for Excel or Google Sheets. */
export function ExportSpendingDialog({
  open,
  onOpenChange,
  expenses,
  log,
  debts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expenses: ExpensesDoc;
  log: ExpenseLogDoc;
  debts: Debt[];
}) {
  const { t } = useI18n();
  const c = t.cashflow.spending.csv;
  const [range, setRange] = useState<(typeof RANGES)[number]>("12");
  const [delimiter, setDelimiter] = useState<"," | ";">(",");

  const download = () => {
    const today = new Date();
    const records = expenseRecords({ expenses, log, debts, monthKeys: monthsEndingAt(monthKeyOf(today), Number(range)), today });
    const st = t.expenses.status;
    const billStatus: Record<BillStatus, string> = {
      paid: st.paid,
      autopaid: st.autopaid,
      skipped: st.skipped,
      overdue: st.unpaid,
      due_today: st.dueToday,
      due_soon: st.upcoming,
      upcoming: st.upcoming,
      unconfirmed: st.unconfirmed,
    };
    const status = (s: BillStatus | BudgetStatus) => (s in billStatus ? billStatus[s as BillStatus] : t.expenses.budgetStatus[s as BudgetStatus]);
    const rows = [
      [c.month, c.date, c.item, c.category, c.type, c.planned, c.actual, c.status, c.note],
      ...records.map((r) => [r.monthKey, r.date, r.name, t.expenses.categories[r.category], t.expenses.kinds[r.kind].label, r.planned, r.actual, status(r.status), r.note]),
    ];
    downloadText(`${c.fileName}-${todayIso()}.csv`, toCsv(rows, { delimiter }), "text/csv;charset=utf-8");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{c.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label>{c.range}</Label>
            <SegmentedControl value={range} onValueChange={setRange} options={RANGES.map((r) => ({ value: r, label: r }))} fullWidth />
          </div>
          <div className="grid gap-2">
            <SegmentedControl
              value={delimiter}
              onValueChange={setDelimiter}
              options={[
                { value: ",", label: c.delimiterComma },
                { value: ";", label: c.delimiterSemicolon },
              ]}
              fullWidth
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button onClick={download}>
            <Download />
            {c.download}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
