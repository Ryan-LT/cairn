"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { BillLine, MonthView } from "@/entities/expense";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { ListGroup } from "@/shared/ui/list";
import { Money } from "@/shared/ui/money";

import { BillRow, BudgetRow, type RecordActions } from "./bill-rows";

type MonthGroupsProps = {
  view: MonthView;
  actions: RecordActions;
  onEdit?: (id: string) => void;
  /** Only show bills due on this ISO day. */
  day?: string | null;
};

/**
 * A month's bills and budgets in the order you act on them: overdue, to
 * confirm, due soon, budgets, later this month, then what's done (folded).
 */
export function MonthGroups({ view, actions, onEdit, day }: MonthGroupsProps) {
  const { t } = useI18n();
  const g = t.cashflow.month.groups;
  const [showDone, setShowDone] = useState(false);
  const readOnly = view.isFuture;
  const pick = (lines: BillLine[]) => (day ? lines.filter((l) => l.dueDates.includes(day)) : lines);

  const billGroup = (key: string, title: string, lines: BillLine[], description?: string) =>
    lines.length ? (
      <ListGroup
        key={key}
        title={title}
        description={description}
        aside={<Money value={lines.reduce((s, l) => s + (l.remaining || l.planned), 0)} compact interactive={false} />}
      >
        {lines.map((l) => (
          <BillRow key={l.item.id} line={l} monthKey={view.monthKey} actions={actions} onEdit={onEdit} readOnly={readOnly} />
        ))}
      </ListGroup>
    ) : null;

  const settled = pick(view.groups.settled);
  const budgets = day ? [] : view.groups.budgets;

  return (
    <div className="grid gap-5">
      {billGroup("overdue", g.overdue, pick(view.groups.overdue))}
      {billGroup("confirm", g.needsConfirm, pick(view.groups.needsConfirm), t.cashflow.month.needsConfirmHint)}
      {billGroup("soon", g.dueSoon, pick(view.groups.dueSoon))}
      {budgets.length ? (
        <ListGroup
          title={g.budgets}
          aside={
            <span>
              <Money value={view.totals.budgetsSpent} compact interactive={false} /> / <Money value={view.totals.budgetsPlanned} compact interactive={false} />
            </span>
          }
        >
          {budgets.map((l) => (
            <BudgetRow key={l.item.id} line={l} monthKey={view.monthKey} actions={actions} onEdit={onEdit} readOnly={readOnly} />
          ))}
        </ListGroup>
      ) : null}
      {billGroup("later", g.upcoming, pick(view.groups.upcoming))}
      {settled.length ? (
        <section className="grid gap-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="flex items-center justify-between gap-3 rounded-md px-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <span className="text-sm font-semibold">
              {g.settled} <span className="font-normal text-muted-foreground">· {settled.length}</span>
            </span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Money value={settled.reduce((s, l) => s + l.settled, 0)} compact interactive={false} />
              <ChevronDown className={cn("size-4 transition-transform", showDone && "rotate-180")} aria-hidden />
            </span>
          </button>
          {showDone ? (
            <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
              <ul className="divide-y">
                {settled.map((l) => (
                  <BillRow key={l.item.id} line={l} monthKey={view.monthKey} actions={actions} onEdit={onEdit} readOnly={readOnly} />
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
