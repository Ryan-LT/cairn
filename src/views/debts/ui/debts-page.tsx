"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard, Flame, Pencil, Percent, Plus, Trash2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  createDebtDraft,
  DEBTS_SEED,
  debtPayoff,
  isValidDayOfMonth,
  sanitizeDebt,
  totalDebtBalance,
  totalMonthlyInterest,
  weightedAverageRate,
  type Debt,
} from "@/entities/debt";
import { useI18n, type Messages } from "@/shared/i18n";
import { formatDate, formatMonths, formatPercent } from "@/shared/lib/format";
import { useTable } from "@/shared/storage";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { DataTable, DataTableColumnHeader, RowActions } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { Badge } from "@/shared/ui/kit/badge";
import { Button } from "@/shared/ui/kit/button";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";
import { StatCard, StatGrid } from "@/shared/ui/stat-card";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { useCreateParam } from "@/shared/lib/use-create-param";

import { DebtFormDialog } from "./debt-form-dialog";

type DialogState = { mode: "create" | "edit"; debt: Debt };

/** Payment column: "Day N each month" (+ note), the note alone, or a dash. */
function describePayment(t: Messages, debt: Debt): { primary: string; secondary?: string } {
  const note = debt.nextPayment.trim();
  if (isValidDayOfMonth(debt.paymentDayOfMonth)) {
    return { primary: t.debts.paymentDay({ day: debt.paymentDayOfMonth }), secondary: note || undefined };
  }
  return { primary: note || "—" };
}

/** Payoff column: date + total interest from the monthly payment, or why it can't be shown. */
function PayoffCell({ debt }: { debt: Debt }) {
  const { t } = useI18n();
  const p = debtPayoff(debt);
  switch (p.kind) {
    case "paid_off":
      return <span className="text-muted-foreground">{t.debts.payoff.paidOff}</span>;
    case "unknown":
      return <span className="text-muted-foreground">{t.debts.payoff.addPayment}</span>;
    case "never":
      return (
        <div>
          <p className="text-danger">{t.debts.payoff.never}</p>
          <p className="text-xs text-muted-foreground">
            {t.debts.payoff.interestAlonePrefix}
            <Money value={p.monthlyInterest} />
            {t.debts.payoff.interestAloneSuffix}
          </p>
        </div>
      );
    case "date":
      return (
        <div>
          <p>
            {formatDate(p.date, "monthYear")} <span className="text-xs text-muted-foreground">({formatMonths(p.months)})</span>
          </p>
          <p className="text-xs text-muted-foreground">
            <Money value={p.totalInterest} />
            {t.debts.payoff.interestLeft}
          </p>
        </div>
      );
  }
}

export function DebtsPage() {
  const { t } = useI18n();
  const [debts, setDebts] = useTable("debts", DEBTS_SEED);
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

  const total = totalDebtBalance(debts);
  const variableTotal = debts.filter((d) => d.rateKind === "Variable").reduce((s, d) => s + d.balance, 0);

  const columns = useMemo<ColumnDef<Debt>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.debts.columns.name} />,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "balance",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.debts.columns.balance} align="right" />,
        cell: ({ row }) => <Money value={row.original.balance} />,
        footer: () => <Money value={total} className="font-semibold" />,
        meta: { align: "right" },
      },
      {
        accessorKey: "ratePct",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.debts.columns.rate} align="right" />,
        cell: ({ row }) => (
          <span className="inline-flex items-center justify-end gap-2">
            <span className="tabular-nums">{formatPercent(row.original.ratePct, { maximumFractionDigits: 3 })}</span>
            <Badge variant={row.original.rateKind === "Variable" ? "warning" : "neutral"}>{t.debts.rateKind[row.original.rateKind]}</Badge>
          </span>
        ),
        meta: { align: "right" },
      },
      {
        id: "payoff",
        header: t.debts.columns.payoff,
        enableSorting: false,
        cell: ({ row }) => <PayoffCell debt={row.original} />,
        meta: { className: "hidden lg:table-cell" },
      },
      {
        id: "payment",
        header: t.debts.columns.payment,
        enableSorting: false,
        cell: ({ row }) => {
          const p = describePayment(t, row.original);
          return (
            <div className="max-w-64 whitespace-normal">
              <p>{p.primary}</p>
              {p.secondary ? <p className="truncate text-xs text-muted-foreground">{p.secondary}</p> : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">{t.common.actions}</span>,
        cell: ({ row }) => (
          <RowActions
            label={t.common.actionsFor({ name: row.original.name })}
            actions={[
              { label: t.common.edit, icon: Pencil, onSelect: () => openEdit(row.original) },
              "separator",
              { label: t.common.delete, icon: Trash2, destructive: true, onSelect: () => setPendingDelete(row.original) },
            ]}
          />
        ),
        meta: { className: "w-12" },
      },
    ],
    [total, t],
  );

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

      <StatGrid>
        <StatCard
          label={t.debts.kpi.total.label}
          icon={CreditCard}
          value={<Money value={total} compact />}
          hint={t.debts.kpi.total.hint({ count: debts.length })}
        />
        <StatCard
          label={t.debts.kpi.avgRate.label}
          icon={Percent}
          value={formatPercent(weightedAverageRate(debts), { maximumFractionDigits: 2 })}
          hint={t.debts.kpi.avgRate.hint}
        />
        <StatCard
          label={t.debts.kpi.variable.label}
          icon={TrendingUp}
          value={<Money value={variableTotal} compact />}
          hint={
            total > 0
              ? t.debts.kpi.variable.hint({ pct: formatPercent((variableTotal / total) * 100, { maximumFractionDigits: 0 }) })
              : t.debts.kpi.variable.none
          }
        />
        <StatCard
          label={t.debts.kpi.interest.label}
          icon={Flame}
          value={<Money value={totalMonthlyInterest(debts)} compact />}
          hint={t.debts.kpi.interest.hint}
        />
      </StatGrid>

      <Section title={t.debts.allDebts} flush>
        <DataTable
          columns={columns}
          data={debts}
          getRowId={(d) => d.id}
          onRowClick={openEdit}
          empty={
            <EmptyState
              icon={CreditCard}
              title={t.debts.empty.title}
              description={t.debts.empty.description}
              action={
                <Button variant="outline" onClick={openCreate}>
                  <Plus />
                  {t.debts.add}
                </Button>
              }
            />
          }
          renderMobileItem={(d) => {
            const p = describePayment(t, d);
            return (
              <div className="flex items-center gap-3 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(d)}>
                  <p className="truncate font-medium">{d.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatPercent(d.ratePct, { maximumFractionDigits: 3 })} {t.debts.rateKindLower[d.rateKind]} · {p.primary}
                  </p>
                </button>
                <Money value={d.balance} className="text-sm font-medium" />
                <RowActions
                  label={t.common.actionsFor({ name: d.name })}
                  actions={[
                    { label: t.common.edit, icon: Pencil, onSelect: () => openEdit(d) },
                    "separator",
                    { label: t.common.delete, icon: Trash2, destructive: true, onSelect: () => setPendingDelete(d) },
                  ]}
                />
              </div>
            );
          }}
        />
      </Section>

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
        onConfirm={() => {
          if (!pendingDelete) return;
          const removed = pendingDelete;
          setDebts((prev) => prev.filter((d) => d.id !== removed.id));
          toast.success(t.debts.toast.deleted, { description: removed.name });
        }}
      />
    </TabContent>
  );
}
