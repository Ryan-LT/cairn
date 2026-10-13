"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { DEBTS_SEED, type Debt } from "@/entities/debt";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import {
  createExpenseDraft,
  removeExpenseItem,
  sanitizeExpenseItem,
  upsertExpenseItem,
  type ExpenseItem,
} from "@/entities/expense";
import { ExpenseFormSheet, type ExpenseFormResult } from "@/features/expense-form";
import { useI18n } from "@/shared/i18n";
import { todayIso } from "@/shared/lib/date";
import { useTable } from "@/shared/storage";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

type DebtPayment = { debtId: string; monthlyPayment: number };

/** Add / edit / delete bills and budgets from any Cash flow tab. Render `element` once. */
export function useExpenseEditor() {
  const { t } = useI18n();
  const { expenses, log, updateExpenses } = useExpenses();
  const [debts, setDebts] = useTable<Debt[]>("debts", DEBTS_SEED);
  const [draft, setDraft] = useState<{ mode: "create" | "edit"; item: ExpenseItem } | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ExpenseItem | null>(null);

  const applyDebtPayments = useCallback(
    (payments: DebtPayment[]) => {
      if (!payments.length) return;
      setDebts((all) => all.map((d) => ({ ...d, monthlyPayment: payments.find((p) => p.debtId === d.id)?.monthlyPayment ?? d.monthlyPayment })));
    },
    [setDebts],
  );

  const openCreate = useCallback((init: Partial<ExpenseItem> = {}) => {
    setDraft({ mode: "create", item: createExpenseDraft(todayIso(), init) });
    setOpen(true);
  }, []);

  const openEdit = useCallback(
    (id: string) => {
      const item = expenses.items.find((i) => i.id === id && !i.archivedAt);
      if (!item) return false;
      setDraft({ mode: "edit", item });
      setOpen(true);
      return true;
    },
    [expenses.items],
  );

  const save = useCallback(
    ({ item, debtPayment }: ExpenseFormResult) => {
      const clean = sanitizeExpenseItem(item, todayIso());
      if (!clean) return;
      updateExpenses((d) => upsertExpenseItem(d, clean));
      if (debtPayment) applyDebtPayments([debtPayment]);
      toast.success(draft?.mode === "create" ? t.expenses.toast.added : t.expenses.toast.updated);
    },
    [applyDebtPayments, draft?.mode, t, updateExpenses],
  );

  /** Add several items at once (quick start). */
  const addMany = useCallback(
    (items: ExpenseItem[], payments: DebtPayment[] = []) => {
      if (!items.length) return;
      updateExpenses((d) => items.reduce((acc, i) => upsertExpenseItem(acc, i), d));
      applyDebtPayments(payments);
      toast.success(t.expenses.toast.addedMany({ count: items.length }));
    },
    [applyDebtPayments, t, updateExpenses],
  );

  const setPaused = useCallback(
    (item: ExpenseItem, paused: boolean) => {
      updateExpenses((d) => upsertExpenseItem(d, { ...item, paused: paused || undefined }));
      toast.success(paused ? t.expenses.toast.paused({ name: item.name }) : t.expenses.toast.resumed({ name: item.name }));
    },
    [t, updateExpenses],
  );

  const element = (
    <>
      <ExpenseFormSheet
        open={open}
        onOpenChange={setOpen}
        mode={draft?.mode ?? "create"}
        item={draft?.item ?? null}
        debts={debts}
        onSubmit={save}
        onDelete={(item) => setPendingDelete(item)}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t.expenses.confirmDelete.title}
        description={pendingDelete ? t.expenses.confirmDelete.description({ name: pendingDelete.name }) : null}
        destructive
        confirmLabel={t.expenses.actions.delete}
        onConfirm={() => {
          if (!pendingDelete) return;
          const removed = pendingDelete;
          const before = expenses;
          updateExpenses((d) => removeExpenseItem(d, log, removed.id, todayIso()));
          toast.success(t.expenses.toast.deleted({ name: removed.name }), {
            action: { label: t.common.undo, onClick: () => updateExpenses(() => before) },
          });
        }}
      />
    </>
  );

  return { expenses, log, debts, openCreate, openEdit, addMany, setPaused, applyDebtPayments, element };
}
