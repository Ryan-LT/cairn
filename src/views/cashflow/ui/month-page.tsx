"use client";

import { CalendarClock, Info, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildMonthView, CategoryTile, liveItems, type BillLine, type BudgetLine } from "@/entities/expense";
import { useHouseholdCashflow } from "@/entities/portfolio/model/use-household-cashflow";
import { useIncomeSources } from "@/entities/income";
import { TemplatePicker } from "@/features/expense-form";
import { useRecordSpending } from "@/features/record-spending";
import { useI18n } from "@/shared/i18n";
import { burstConfetti } from "@/shared/lib/celebrate";
import { todayIso } from "@/shared/lib/date";
import { formatDate, formatMoney, formatPercent } from "@/shared/lib/format";
import { addMonths, monthKeyOf } from "@/shared/lib/month";
import { useCreateParam } from "@/shared/lib/use-create-param";

import { Callout } from "@/shared/ui/callout";
import { EmptyState } from "@/shared/ui/empty-state";
import { Button } from "@/shared/ui/kit/button";
import { Card } from "@/shared/ui/kit/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { ListGroup, ListRow } from "@/shared/ui/list";
import { Money } from "@/shared/ui/money";
import { MonthSwitcher } from "@/shared/ui/month-switcher";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { MonthGroups } from "@/widgets/bill-list";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { useExpenseEditor } from "../model/use-expense-editor";
import { CalendarStrip } from "./calendar-strip";

/** "Record a payment": pick an open bill or a budget, then the pay / spend sheet opens. */
function RecordPicker({
  open,
  onOpenChange,
  bills,
  budgets,
  onPickBill,
  onPickBudget,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bills: BillLine[];
  budgets: BudgetLine[];
  onPickBill: (l: BillLine) => void;
  onPickBudget: (l: BudgetLine) => void;
}) {
  const { t } = useI18n();
  const r = t.cashflow.month.record;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{r.title}</DialogTitle>
          <DialogDescription>{r.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {bills.length === 0 && budgets.length === 0 ? <p className="text-sm text-muted-foreground">{r.empty}</p> : null}
          {bills.length ? (
            <ListGroup title={r.bills}>
              {bills.map((l) => (
                <ListRow
                  key={l.item.id}
                  leading={<CategoryTile category={l.item.category} size="sm" />}
                  title={l.item.name}
                  subtitle={l.nextDue ? formatDate(l.nextDue, "dayMonth") : undefined}
                  trailing={<Money value={l.remaining} compact interactive={false} />}
                  onClick={() => {
                    onOpenChange(false);
                    onPickBill(l);
                  }}
                />
              ))}
            </ListGroup>
          ) : null}
          {budgets.length ? (
            <ListGroup title={r.budgets}>
              {budgets.map((l) => (
                <ListRow
                  key={l.item.id}
                  leading={<CategoryTile category={l.item.category} size="sm" />}
                  title={l.item.name}
                  trailing={<Money value={l.spent} compact interactive={false} />}
                  trailingSub={<Money value={l.planned} compact interactive={false} />}
                  onClick={() => {
                    onOpenChange(false);
                    onPickBudget(l);
                  }}
                />
              ))}
            </ListGroup>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** Cash flow › This month: what's due, what's paid, budgets, and what's left. */
export function CashflowMonthPage() {
  const { t } = useI18n();
  const m = t.cashflow.month;
  const editor = useExpenseEditor();
  const actions = useRecordSpending();
  const cash = useHouseholdCashflow();
  const [sources] = useIncomeSources();
  const now = new Date();
  const current = monthKeyOf(now);
  const [monthKey, setMonthKey] = useState(current);
  const [day, setDay] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);

  useCreateParam(() => setRecordOpen(true), editor.openEdit);

  const paydays = useMemo(() => sources.filter((s) => s.paymentDay).map((s) => ({ id: s.id, name: s.name, day: s.paymentDay! })), [sources]);
  const view = useMemo(
    () => buildMonthView({ expenses: editor.expenses, log: editor.log, debts: editor.debts, monthKey, today: new Date(), paydays }),
    [editor.expenses, editor.log, editor.debts, monthKey, paydays],
  );
  const hasItems = liveItems(editor.expenses.items).length > 0;
  const totals = view.totals;
  const share = totals.planned > 0 ? totals.settled / totals.planned : 0;
  const leftAtEnd = cash.totalIncome - totals.projected;
  const open = [...view.groups.overdue, ...view.groups.needsConfirm, ...view.groups.dueSoon, ...view.groups.upcoming];

  // Confetti from the ring when the last bill of the month gets paid here (not when opening a finished month).
  const ringRef = useRef<HTMLSpanElement>(null);
  const lastShare = useRef({ monthKey, share });
  useEffect(() => {
    const prev = lastShare.current;
    if (prev.monthKey === monthKey && prev.share < 1 && share >= 1) burstConfetti(ringRef.current, { count: 26, distance: 72, size: 7 });
    lastShare.current = { monthKey, share };
  }, [monthKey, share]);

  const changeMonth = (key: string) => {
    setMonthKey(key);
    setDay(null);
  };

  return (
    <TabContent>
      <TabToolbar
        actions={
          <Button onClick={() => editor.openCreate()}>
            <Plus />
            {t.cashflow.spending.add}
          </Button>
        }
      >
        <MonthSwitcher value={monthKey} current={current} onChange={changeMonth} min={addMonths(current, -35)} max={addMonths(current, 12)} />
      </TabToolbar>

      {!hasItems ? (
        <Card className="gap-0 py-0">
          {cash.spending.source === "estimate" ? (
            <div className="px-5 pt-5">
              <Callout tone="info" title={m.estimateOnly.title}>
                <span data-private>{m.estimateOnly.body({ amount: formatMoney(cash.averageSpending) })}</span>
              </Callout>
            </div>
          ) : null}
          <EmptyState illustrated title={m.empty.title} description={m.empty.description} />
          <div className="border-t px-5 py-5">
            <p className="mb-3 text-sm font-semibold">{t.expenses.templatesPicker.title}</p>
            <TemplatePicker debts={editor.debts} onAdd={editor.addMany} />
          </div>
        </Card>
      ) : (
        <>
          <Card className="bg-hero gap-4 px-5">
            <div className="flex items-center gap-4 md:gap-6">
              <span ref={ringRef} className="shrink-0">
                <ProgressRing value={share} size={76} stroke={8} label={m.ringLabel({ pct: formatPercent(share * 100, { maximumFractionDigits: 0 }) })}>
                  {formatPercent(Math.min(999, share * 100), { maximumFractionDigits: 0 })}
                </ProgressRing>
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="text-sm text-muted-foreground">{m.settled}</p>
                <p className="text-display font-semibold">
                  <Money value={totals.settled} compact />
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / <Money value={totals.planned} compact interactive={false} />
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{m.billsDone({ done: totals.billsDone, total: totals.billsCount })}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">{m.remaining}</dt>
                <dd className="font-semibold">
                  <Money value={totals.remaining} compact />
                </dd>
              </div>
              {view.isPast ? null : (
                <div className="grid gap-0.5">
                  <dt className="text-muted-foreground" title={m.endOfMonthHint}>
                    {m.endOfMonth}
                  </dt>
                  <dd className="font-semibold">
                    <Money value={leftAtEnd} compact signed tone="auto" />
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <CalendarStrip view={view} todayIso={todayIso()} selected={day} onSelect={setDay} />

          {day ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2 text-sm">
              <span className="flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                {m.filtered({ date: formatDate(day, "dayMonth") })}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setDay(null)}>
                <X />
                {m.clearFilter}
              </Button>
            </div>
          ) : null}

          {view.isPast || view.isFuture ? (
            <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0" aria-hidden />
              {view.isPast ? m.pastMonth : m.futureMonth}
            </p>
          ) : null}

          {view.lines.length ? <MonthGroups view={view} actions={actions} onEdit={editor.openEdit} day={day} /> : <p className="px-1 text-sm text-muted-foreground">{m.nothing}</p>}

          {cash.spending.unitemized > 0 ? (
            <Link href="/cashflow/spending" className="px-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
              {t.cashflow.spending.unitemizedRow} · <Money value={cash.spending.unitemized} compact interactive={false} />
            </Link>
          ) : null}
        </>
      )}

      <RecordPicker
        open={recordOpen}
        onOpenChange={setRecordOpen}
        bills={view.isCurrent ? open : []}
        budgets={view.isCurrent ? view.groups.budgets : []}
        onPickBill={(l) => actions.openPay(l, view.monthKey)}
        onPickBudget={(l) => actions.openSpend(l, view.monthKey)}
      />
      {actions.sheet}
      {editor.element}
    </TabContent>
  );
}
