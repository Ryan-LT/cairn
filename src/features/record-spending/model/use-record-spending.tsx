"use client";

import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DEBTS_SEED, type Debt } from "@/entities/debt";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import {
  addBudgetSpend,
  clearBillPayments,
  principalPart,
  recordBillPayment,
  setBillSkipped,
  setBudgetSpent,
  setMonthEntry,
  suggestedPayment,
  type BillLine,
  type BudgetLine,
} from "@/entities/expense";
import { useI18n } from "@/shared/i18n";
import { todayIso } from "@/shared/lib/date";
import { formatMoney } from "@/shared/lib/format";
import { useTable } from "@/shared/storage";
import { AmountSheet } from "@/shared/ui/amount-sheet";
import { Label } from "@/shared/ui/kit/label";
import { Switch } from "@/shared/ui/kit/switch";

const SPEND_PRESETS = [50_000, 100_000, 200_000, 500_000];

type Sheet =
  | { kind: "pay"; line: BillLine; monthKey: string; /** Correcting the last recorded payment. */ replaceLast?: boolean }
  | { kind: "spend"; line: BudgetLine; monthKey: string }
  | { kind: "setSpent"; line: BudgetLine; monthKey: string };

/**
 * Recording money out for a month: one-tap "paid" (with undo), paying a
 * different amount, skipping a month, and adding to a budget. Render
 * `sheet` once in the page.
 */
export function useRecordSpending() {
  const { t } = useI18n();
  const m = t.expenses;
  const { log, updateLog } = useExpenses();
  const [, setDebts] = useTable<Debt[]>("debts", DEBTS_SEED);
  const [open, setOpen] = useState<Sheet | null>(null);
  const [reduceDebt, setReduceDebt] = useState(false);

  /** Run a log change with an undo toast that restores the previous entry. */
  const withUndo = useCallback(
    (monthKey: string, itemId: string, change: () => void, message: string, extra?: { label: string; onClick: () => void }) => {
      const before = log.months[monthKey]?.[itemId];
      change();
      toast.success(message, {
        action: { label: t.common.undo, onClick: () => updateLog((l) => setMonthEntry(l, monthKey, itemId, before)) },
        cancel: extra ? { label: extra.label, onClick: extra.onClick } : undefined,
      });
    },
    [log, t, updateLog],
  );

  const pay = useCallback(
    (line: BillLine, monthKey: string, amount = suggestedPayment(line), date = todayIso()) => {
      withUndo(
        monthKey,
        line.item.id,
        () => updateLog((l) => recordBillPayment(l, { monthKey, itemId: line.item.id, planned: line.planned, amount, date })),
        m.toast.paid({ name: line.item.name }),
        { label: m.toast.editAmount, onClick: () => setOpen({ kind: "pay", line, monthKey, replaceLast: true }) },
      );
    },
    [m, updateLog, withUndo],
  );

  const unpay = useCallback(
    (line: BillLine, monthKey: string) =>
      withUndo(monthKey, line.item.id, () => updateLog((l) => clearBillPayments(l, monthKey, line.item.id)), m.toast.unpaid({ name: line.item.name })),
    [m, updateLog, withUndo],
  );

  const skip = useCallback(
    (line: BillLine, monthKey: string, skipped: boolean) =>
      withUndo(
        monthKey,
        line.item.id,
        () => updateLog((l) => setBillSkipped(l, { monthKey, itemId: line.item.id, planned: line.planned, skipped })),
        skipped ? m.toast.skipped({ name: line.item.name }) : t.expenses.toast.updated,
      ),
    [m, t, updateLog, withUndo],
  );

  const openPay = useCallback((line: BillLine, monthKey: string, opts: { replaceLast?: boolean } = {}) => {
    setReduceDebt(false);
    setOpen({ kind: "pay", line, monthKey, replaceLast: opts.replaceLast });
  }, []);
  const openSpend = useCallback((line: BudgetLine, monthKey: string) => setOpen({ kind: "spend", line, monthKey }), []);
  const openSetSpent = useCallback((line: BudgetLine, monthKey: string) => setOpen({ kind: "setSpent", line, monthKey }), []);

  const close = (o: boolean) => !o && setOpen(null);
  let sheet: ReactNode = null;
  if (open?.kind === "pay") {
    const { line, monthKey, replaceLast } = open;
    const debt = line.debt;
    const principal = debt ? principalPart(debt, suggestedPayment(line)) : 0;
    sheet = (
      <AmountSheet
        open
        onOpenChange={close}
        title={m.paySheet.title({ name: line.item.name })}
        description={m.paySheet.description}
        amountLabel={m.paySheet.amount}
        initial={replaceLast && line.payments.length ? line.payments[line.payments.length - 1].amount : suggestedPayment(line)}
        initialDate={todayIso()}
        confirmLabel={m.paySheet.confirm}
        onConfirm={(amount, date) => {
          updateLog((l) => {
            // Correcting an amount replaces the last recorded payment instead of adding one.
            const entry = l.months[monthKey]?.[line.item.id];
            const base = replaceLast && entry?.payments?.length ? setMonthEntry(l, monthKey, line.item.id, { ...entry, payments: entry.payments.slice(0, -1) }) : l;
            return recordBillPayment(base, { monthKey, itemId: line.item.id, planned: line.planned, amount, date: date || todayIso() });
          });
          if (debt && reduceDebt) {
            const cut = principalPart(debt, amount);
            setDebts((all) => all.map((d) => (d.id === debt.id ? { ...d, balance: Math.max(0, d.balance - cut) } : d)));
            toast.success(m.toast.principalReduced);
          } else {
            toast.success(m.toast.paid({ name: line.item.name }));
          }
        }}
      >
        {debt && principal > 0 ? (
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <Label htmlFor="reduce-debt" className="leading-snug font-normal">
              <span data-private>{m.paySheet.reducePrincipal({ amount: formatMoney(principal) })}</span>
            </Label>
            <Switch id="reduce-debt" checked={reduceDebt} onCheckedChange={setReduceDebt} />
          </div>
        ) : null}
      </AmountSheet>
    );
  } else if (open?.kind === "spend") {
    const { line, monthKey } = open;
    sheet = (
      <AmountSheet
        open
        onOpenChange={close}
        title={m.spendSheet.title({ name: line.item.name })}
        description={<span data-private>{m.spendSheet.description({ spent: formatMoney(line.spent), planned: formatMoney(line.planned) })}</span>}
        amountLabel={m.spendSheet.amount}
        initial={0}
        presets={SPEND_PRESETS}
        presetMode="add"
        confirmLabel={m.spendSheet.confirm}
        onConfirm={(amount) =>
          withUndo(
            monthKey,
            line.item.id,
            () => updateLog((l) => addBudgetSpend(l, { monthKey, itemId: line.item.id, planned: line.planned, amount })),
            m.toast.spent({ name: line.item.name }),
          )
        }
      />
    );
  } else if (open?.kind === "setSpent") {
    const { line, monthKey } = open;
    sheet = (
      <AmountSheet
        open
        onOpenChange={close}
        title={m.spendSheet.setTitle({ name: line.item.name })}
        amountLabel={m.spendSheet.setAmount}
        initial={line.spent}
        allowZero
        confirmLabel={m.spendSheet.setConfirm}
        onConfirm={(spent) =>
          withUndo(
            monthKey,
            line.item.id,
            () => updateLog((l) => setBudgetSpent(l, { monthKey, itemId: line.item.id, planned: line.planned, spent })),
            t.expenses.toast.updated,
          )
        }
      />
    );
  }

  return { pay, unpay, skip, openPay, openSpend, openSetSpent, sheet };
}
