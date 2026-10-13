"use client";

import { Check, CircleSlash, Pencil, Plus, RotateCcw, Undo2, Wallet } from "lucide-react";

import {
  BILL_STATUS_TONE,
  BUDGET_STATUS_TONE,
  billDateText,
  billStatusText,
  budgetStatusText,
  CategoryTile,
  type BillLine,
  type BudgetLine,
} from "@/entities/expense";
import { useRecordSpending } from "@/features/record-spending";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import type { StatusTone } from "@/shared/lib/tone";
import { RowActions, type RowAction } from "@/shared/ui/data-table";
import { Button } from "@/shared/ui/kit/button";
import { ListRow } from "@/shared/ui/list";
import { Money } from "@/shared/ui/money";

const TONE_TEXT: Record<StatusTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

const BAR_TONE: Record<StatusTone, string> = {
  neutral: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export type RecordActions = ReturnType<typeof useRecordSpending>;

/** One bill this month: status and due date, the amount, and a check button to mark it paid (tap again to undo). */
export function BillRow({
  line,
  monthKey,
  actions,
  onEdit,
  readOnly,
}: {
  line: BillLine;
  monthKey: string;
  actions: RecordActions;
  onEdit?: (id: string) => void;
  /** Future months: nothing to tick yet. */
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const a = t.expenses.actions;
  const done = line.status === "paid" || line.status === "autopaid";
  const skipped = line.status === "skipped";
  const tone = BILL_STATUS_TONE[line.status];
  const date = billDateText(t, line);
  const shown = line.paid > 0 ? line.paid : line.planned;

  const menu: RowAction[] = [
    ...(readOnly
      ? []
      : done && line.paidCount > 0
        ? [
            { label: t.expenses.toast.editAmount, icon: Wallet, onSelect: () => actions.openPay(line, monthKey, { replaceLast: true }) },
            { label: a.unpay, icon: Undo2, onSelect: () => actions.unpay(line, monthKey) },
          ]
        : skipped
          ? [{ label: a.unskip, icon: RotateCcw, onSelect: () => actions.skip(line, monthKey, false) }]
          : [
              { label: a.markPaid, icon: Check, onSelect: () => actions.pay(line, monthKey) },
              { label: a.payOther, icon: Wallet, onSelect: () => actions.openPay(line, monthKey) },
              { label: a.skip, icon: CircleSlash, onSelect: () => actions.skip(line, monthKey, true) },
            ]),
    ...(onEdit ? (["separator", { label: a.edit, icon: Pencil, onSelect: () => onEdit(line.item.id) }] as RowAction[]) : []),
  ];

  return (
    <ListRow
      className="animate-row-in motion-reduce:animate-none"
      leading={<CategoryTile category={line.item.category} />}
      title={line.item.name}
      muted={skipped}
      subtitle={
        <>
          <span className={cn("font-medium", TONE_TEXT[tone])}>{billStatusText(t, line)}</span>
          {date ? <span> · {date}</span> : null}
        </>
      }
      trailing={<Money value={shown} compact interactive={false} strike={skipped} />}
      trailingSub={line.paid > 0 && Math.round(line.paid) !== Math.round(line.planned) ? <Money value={line.planned} compact interactive={false} tone="muted" strike /> : undefined}
      onClick={onEdit ? () => onEdit(line.item.id) : undefined}
      label={line.item.name}
      actions={
        <>
          {readOnly || skipped ? null : done ? (
            <button
              type="button"
              onClick={() => line.paidCount > 0 && actions.unpay(line, monthKey)}
              disabled={line.paidCount === 0}
              aria-label={`${a.unpay}: ${line.item.name}`}
              className="flex size-9 items-center justify-center rounded-full bg-success text-success-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-80"
            >
              <Check className="size-4 animate-check-pop motion-reduce:animate-none" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => actions.pay(line, monthKey)}
              aria-label={`${a.markPaid}: ${line.item.name}`}
              className="flex size-9 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 text-muted-foreground transition-colors outline-none hover:border-success hover:bg-success-muted hover:text-success focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <Check className="size-4 opacity-40" aria-hidden />
            </button>
          )}
          {menu.length ? <RowActions label={t.common.actionsFor({ name: line.item.name })} actions={menu} /> : null}
        </>
      }
    />
  );
}

/** One budget this month: how much is spent against the plan, and a quick "+ spent". */
export function BudgetRow({
  line,
  monthKey,
  actions,
  onEdit,
  readOnly,
}: {
  line: BudgetLine;
  monthKey: string;
  actions: RecordActions;
  onEdit?: (id: string) => void;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const a = t.expenses.actions;
  const tone = BUDGET_STATUS_TONE[line.status];
  const share = line.planned > 0 ? Math.min(1, line.spent / line.planned) : line.spent > 0 ? 1 : 0;
  const pace = line.planned > 0 ? Math.min(1, line.expectedByNow / line.planned) : 0;
  const menu: RowAction[] = [
    ...(readOnly ? [] : [{ label: a.setSpent, icon: Wallet, onSelect: () => actions.openSetSpent(line, monthKey) }]),
    ...(onEdit ? [{ label: a.edit, icon: Pencil, onSelect: () => onEdit(line.item.id) }] : []),
  ];

  return (
    <ListRow
      className="animate-row-in motion-reduce:animate-none"
      leading={<CategoryTile category={line.item.category} />}
      title={line.item.name}
      subtitle={
        <span className="mt-1 grid gap-1.5">
          <span className="relative block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500", BAR_TONE[tone])} style={{ width: `${share * 100}%` }} />
            {pace > 0 && pace < 1 ? <span className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${pace * 100}%` }} /> : null}
          </span>
          <span>
            <span className={cn("font-medium", TONE_TEXT[tone])}>{budgetStatusText(t, line)}</span>
            {" · "}
            <Money value={line.spent} compact interactive={false} /> / <Money value={line.planned} compact interactive={false} />
          </span>
        </span>
      }
      trailing={<Money value={Math.abs(line.remaining)} compact interactive={false} tone={line.remaining < 0 ? "danger" : "none"} />}
      trailingSub={line.remaining < 0 ? t.expenses.overShort : t.expenses.leftShort}
      onClick={onEdit ? () => onEdit(line.item.id) : undefined}
      label={line.item.name}
      actions={
        <>
          {readOnly ? null : (
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => actions.openSpend(line, monthKey)}>
              <Plus />
              {a.addSpend}
            </Button>
          )}
          {menu.length ? <RowActions label={t.common.actionsFor({ name: line.item.name })} actions={menu} /> : null}
        </>
      }
    />
  );
}
