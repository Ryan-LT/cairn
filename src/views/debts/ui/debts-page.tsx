"use client";

import { Check, CreditCard, Flame, Pencil, Percent, Plus, Trash2, TrendingDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  avalancheTarget,
  createDebtDraft,
  DEBTS_SEED,
  debtPayoff,
  extraPaymentImpact,
  isValidDayOfMonth,
  sanitizeDebt,
  suggestedExtraPayment,
  totalMonthlyInterest,
  weightedAverageRate,
  type Debt,
} from "@/entities/debt";
import { billForDebt, createExpenseDraft, removeExpenseItem, upsertExpenseItem } from "@/entities/expense";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { useI18n, type Messages } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { todayIso } from "@/shared/lib/date";
import { formatDate, formatMoney, formatMoneyCompact, formatPercent } from "@/shared/lib/format";
import { useCreateParam } from "@/shared/lib/use-create-param";
import { useTable } from "@/shared/storage";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { RowActions } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Badge } from "@/shared/ui/kit/badge";
import { Button } from "@/shared/ui/kit/button";
import { Card } from "@/shared/ui/kit/card";
import { ListGroup, ListRow } from "@/shared/ui/list";
import { Money } from "@/shared/ui/money";
import { HelpHint } from "@/shared/ui/help-hint";
import { StatCard, StatGrid } from "@/shared/ui/stat-card";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { DebtFormDialog } from "./debt-form-dialog";

type DialogState = { mode: "create" | "edit"; debt: Debt };

/** "9,5 % cố định · Hạn ngày 15 · Trả xong thg 6, 2031" */
function debtSubtitle(t: Messages, debt: Debt): { text: string; tone?: "danger" | "muted" } {
  const parts = [`${formatPercent(debt.ratePct)} ${t.debts.rateKindLower[debt.rateKind]}`];
  if (isValidDayOfMonth(debt.paymentDayOfMonth)) parts.push(t.expenses.schedule.dueDay({ day: debt.paymentDayOfMonth }));
  const p = debtPayoff(debt);
  if (p.kind === "date") parts.push(t.wealth.debts.payoffOn({ date: formatDate(p.date, "monthYear") }));
  if (p.kind === "paid_off") parts.push(t.debts.payoff.paidOff);
  return { text: parts.join(" · "), tone: p.kind === "never" ? "danger" : undefined };
}

/** Net worth › Debts: balances, payoff dates, which to pay first, and repayments in spending. */
export function DebtsPage() {
  const { t } = useI18n();
  const w = t.wealth.debts;
  const [debts, setDebts] = useTable<Debt[]>("debts", DEBTS_SEED);
  const { expenses, log, updateExpenses } = useExpenses();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Debt | null>(null);

  const openCreate = () => {
    setDialog({ mode: "create", debt: createDebtDraft() });
    setDialogOpen(true);
  };
  const openEdit = (debt: Debt) => {
    setDialog({ mode: "edit", debt: { ...debt } });
    setDialogOpen(true);
  };
  useCreateParam(openCreate, (id) => {
    const d = debts.find((x) => x.id === id);
    if (d) openEdit(d);
  });

  const sorted = [...debts].sort((a, b) => b.ratePct - a.ratePct || b.balance - a.balance);
  const target = avalancheTarget(debts);
  const extra = target ? suggestedExtraPayment(target) : 0;
  const impact = target ? extraPaymentImpact(target, extra) : null;
  const monthlyTotal = debts.reduce((s, d) => s + (d.balance > 0 ? (d.monthlyPayment ?? 0) : 0), 0);

  const addToSpending = (debt: Debt) => {
    updateExpenses((d) =>
      upsertExpenseItem(d, createExpenseDraft(todayIso(), { name: debt.name, category: "debt", kind: "bill", amount: debt.monthlyPayment ?? 0, debtId: debt.id })),
    );
    toast.success(w.addedToSpending({ name: debt.name }));
  };

  return (
    <TabContent>
      <TabToolbar
        actions={
          <Button onClick={openCreate}>
            <Plus />
            {t.debts.add}
          </Button>
        }
      />

      {debts.length === 0 ? (
        <Card className="gap-0 py-0">
          <EmptyState
            art="shield"
            title={t.debts.empty.title}
            description={t.debts.empty.description}
            action={
              <Button onClick={openCreate}>
                <Plus />
                {t.debts.add}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <StatGrid className="xl:grid-cols-3">
            <StatCard help="debtAvgRate" tone="rose" label={t.debts.kpi.avgRate.label} icon={Percent} value={formatPercent(weightedAverageRate(debts))} hint={t.debts.kpi.avgRate.hint} />
            <StatCard help="debtInterest" tone="orange" label={t.debts.kpi.interest.label} icon={Flame} value={<Money value={totalMonthlyInterest(debts)} compact />} hint={t.debts.kpi.interest.hint} />
            <StatCard
              className="max-xl:col-span-2"
              help="debtMonthly"
              tone="amber"
              label={t.debts.form.monthlyPayment}
              icon={TrendingDown}
              value={<Money value={monthlyTotal} compact />}
              hint={t.debts.kpi.total.hint({ count: debts.length })}
            />
          </StatGrid>

          {target && debts.length > 1 ? (
            <Card className="gap-2 border-capstone/50 bg-capstone-soft px-5" data-help="debtPriority">
              <p className="flex items-center gap-2 text-sm font-semibold text-capstone-ink">
                <Flame className="size-4" aria-hidden />
                {w.priority}: {target.name} · {formatPercent(target.ratePct)}
                <HelpHint topic="debtPriority" className="-my-1" />
              </p>
              <p className="text-sm">{w.priorityHint}</p>
              {impact && impact.monthsSaved > 0 ? (
                <p className="text-sm" data-private>
                  {w.extra({ extra: formatMoney(extra), months: impact.monthsSaved, interest: formatMoney(Math.round(impact.interestSaved)) })}
                </p>
              ) : null}
            </Card>
          ) : null}

          <ListGroup title={t.debts.allDebts} help="debtList" aside={<Money value={debts.reduce((s, d) => s + Math.max(0, d.balance), 0)} compact interactive={false} />}>
            {sorted.map((d) => {
              const sub = debtSubtitle(t, d);
              const bill = billForDebt(expenses.items, d.id);
              const canAdd = !bill && (d.monthlyPayment ?? 0) > 0 && d.balance > 0;
              const isPriority = target?.id === d.id && debts.length > 1;
              return (
                <ListRow
                  key={d.id}
                  leading={<IconTile icon={CreditCard} color="var(--tone-rose)" background="var(--tone-rose-soft)" />}
                  title={
                    <span className="flex items-center gap-2">
                      <span className="truncate">{d.name}</span>
                      {isPriority ? (
                        <Badge variant="outline" className="border-capstone/60 text-capstone-ink max-sm:hidden">
                          {w.priority}
                        </Badge>
                      ) : null}
                    </span>
                  }
                  subtitle={
                    <span className={cn(sub.tone === "danger" && "text-danger")}>
                      {/* Phones: the badge moves here so the name keeps its width. */}
                      {isPriority ? <span className="font-medium text-capstone-ink sm:hidden">{w.priority} · </span> : null}
                      {sub.text}
                    </span>
                  }
                  trailing={<Money value={d.balance} compact interactive={false} />}
                  trailingSub={
                    (d.monthlyPayment ?? 0) > 0 ? (
                      <span data-private>
                        <span className="max-sm:hidden">{w.perMonth({ amount: formatMoney(d.monthlyPayment!) })}</span>
                        <span className="sm:hidden">{w.perMonth({ amount: formatMoneyCompact(d.monthlyPayment!) })}</span>
                      </span>
                    ) : (
                      w.noPayment
                    )
                  }
                  onClick={() => openEdit(d)}
                  label={d.name}
                  actions={
                    <>
                      {bill ? (
                        <span className="hidden items-center gap-1 text-xs text-success sm:flex" title={w.inSpending}>
                          <Check className="size-3.5" aria-hidden />
                          {w.inSpending}
                        </span>
                      ) : canAdd ? (
                        <Button variant="outline" size="sm" className="max-sm:hidden" onClick={() => addToSpending(d)}>
                          <Plus />
                          {w.addToSpending}
                        </Button>
                      ) : null}
                      <RowActions
                        label={t.common.actionsFor({ name: d.name })}
                        actions={[
                          ...(canAdd ? [{ label: w.addToSpending, icon: Plus, onSelect: () => addToSpending(d) }] : []),
                          { label: t.common.edit, icon: Pencil, onSelect: () => openEdit(d) },
                          "separator",
                          { label: t.common.delete, icon: Trash2, destructive: true, onSelect: () => setPendingDelete(d) },
                        ]}
                      />
                    </>
                  }
                />
              );
            })}
          </ListGroup>
        </>
      )}

      <DebtFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialog?.mode ?? "create"}
        debt={dialog?.debt ?? null}
        onSubmit={(draft) => {
          const next = sanitizeDebt(draft);
          if (dialog?.mode === "edit") {
            setDebts((prev) => prev.map((d) => (d.id === next.id ? next : d)));
            toast.success(t.debts.toast.updated);
          } else {
            setDebts((prev) => [...prev, next]);
            toast.success(t.debts.toast.added);
          }
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t.debts.confirmDelete.title}
        description={pendingDelete ? t.debts.confirmDelete.description({ name: pendingDelete.name }) : null}
        destructive
        onConfirm={() => {
          if (!pendingDelete) return;
          const removed = pendingDelete;
          setDebts((prev) => prev.filter((d) => d.id !== removed.id));
          // Its repayment stops counting as money out too.
          const bill = billForDebt(expenses.items, removed.id);
          if (bill) updateExpenses((d) => removeExpenseItem(d, log, bill.id, todayIso()));
          toast.success(t.debts.toast.deleted, { description: bill ? w.billArchived : removed.name });
        }}
      />
    </TabContent>
  );
}
