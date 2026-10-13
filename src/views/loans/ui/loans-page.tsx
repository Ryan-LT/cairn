"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowUpRight, CircleCheck, HandCoins, Info, Pencil, Plus, RotateCcw, Scale, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  createPersonalLoanDraft,
  PERSONAL_LOANS_SEED,
  sanitizePersonalLoan,
  sortPersonalLoans,
  toggleLoanStatus,
  totalOpenAmount,
  type PersonalLoan,
  type PersonalLoanDirection,
} from "@/entities/personal-loan";
import { PREFERENCES_SEED } from "@/entities/preferences";
import { useI18n } from "@/shared/i18n";
import { formatDate, formatMoney } from "@/shared/lib/format";
import { useCreateParam } from "@/shared/lib/use-create-param";
import { useTable } from "@/shared/storage";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { DataTable, DataTableColumnHeader, DataTableToolbar, matchesSearch, RowActions, type RowAction } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { Button } from "@/shared/ui/kit/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { StatCard, StatGrid } from "@/shared/ui/stat-card";
import { StatusBadge } from "@/shared/ui/status-badge";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { LoanFormDialog } from "./loan-form-dialog";

type DirectionFilter = "all" | PersonalLoanDirection;
type StatusFilter = "all" | "open" | "settled";
type DialogState = { mode: "create" | "edit"; loan: PersonalLoan };

function DirectionBadge({ direction }: { direction: PersonalLoanDirection }) {
  const { t } = useI18n();
  return direction === "lent_out" ? (
    <StatusBadge tone="success" icon={ArrowUpRight}>
      {t.loans.owedToYou}
    </StatusBadge>
  ) : (
    <StatusBadge tone="danger" icon={ArrowDownLeft}>
      {t.loans.youOwe}
    </StatusBadge>
  );
}

export function LoansPage() {
  const { t } = useI18n();
  const [loans, setLoans] = useTable<PersonalLoan[]>("personalLoans", PERSONAL_LOANS_SEED);
  const [prefs] = useTable("preferences", PREFERENCES_SEED);
  const countsInNetWorth = prefs.includeLoansInNetWorth === true;
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PersonalLoan | null>(null);

  const openCreate = useCallback(() => {
    setDialog({ mode: "create", loan: createPersonalLoanDraft(direction === "borrowed" ? "borrowed" : "lent_out") });
    setDialogOpen(true);
  }, [direction]);
  const openEdit = useCallback((loan: PersonalLoan) => {
    setDialog({ mode: "edit", loan: { ...loan } });
    setDialogOpen(true);
  }, []);
  useCreateParam(openCreate, (id) => {
    const l = loans.find((x) => x.id === id);
    if (l) openEdit(l);
  });

  const toggle = useCallback(
    (loan: PersonalLoan) => {
      const next = toggleLoanStatus(loan);
      setLoans((prev) => prev.map((l) => (l.id === loan.id ? next : l)));
      toast.success(next.status === "settled" ? t.loans.toast.settled : t.loans.toast.reopened, { description: loan.person });
    },
    [setLoans, t],
  );

  const actionsFor = useCallback(
    (loan: PersonalLoan): RowAction[] => [
      loan.status === "open"
        ? { label: t.loans.actions.markSettled, icon: CircleCheck, onSelect: () => toggle(loan) }
        : { label: t.loans.actions.reopen, icon: RotateCcw, onSelect: () => toggle(loan) },
      { label: t.common.edit, icon: Pencil, onSelect: () => openEdit(loan) },
      "separator",
      { label: t.common.delete, icon: Trash2, destructive: true, onSelect: () => setPendingDelete(loan) },
    ],
    [toggle, openEdit, t],
  );

  const owedToYou = totalOpenAmount(loans, "lent_out");
  const youOwe = totalOpenAmount(loans, "borrowed");

  const visible = useMemo(
    () =>
      sortPersonalLoans(loans).filter(
        (l) =>
          (direction === "all" || l.direction === direction) &&
          (status === "all" || l.status === status) &&
          matchesSearch(`${l.person} ${l.note ?? ""}`, search),
      ),
    [loans, direction, status, search],
  );

  const columns = useMemo<ColumnDef<PersonalLoan>[]>(
    () => [
      {
        accessorKey: "person",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.loans.columns.person} />,
        cell: ({ row }) => (
          <div className="max-w-56 min-w-0 whitespace-normal">
            <p className={row.original.status === "settled" ? "font-medium text-muted-foreground" : "font-medium"}>{row.original.person}</p>
            {row.original.note ? <p className="truncate text-xs text-muted-foreground">{row.original.note}</p> : null}
          </div>
        ),
      },
      {
        accessorKey: "direction",
        header: t.loans.columns.direction,
        enableSorting: false,
        cell: ({ row }) => <DirectionBadge direction={row.original.direction} />,
      },
      {
        accessorKey: "date",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.loans.columns.date} />,
        sortUndefined: "last",
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.date)}</span>,
      },
      {
        accessorKey: "status",
        header: t.loans.columns.status,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === "open" ? (
            <StatusBadge tone="info" dot>
              {t.loans.open}
            </StatusBadge>
          ) : (
            <StatusBadge dot>{t.loans.settled}</StatusBadge>
          ),
      },
      {
        accessorKey: "amount",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.loans.columns.amount} align="right" />,
        cell: ({ row }) => (
          <Money
            value={row.original.amount}
            strike={row.original.status === "settled"}
            tone={row.original.status === "settled" ? "muted" : row.original.direction === "lent_out" ? "success" : "danger"}
            className="font-medium"
          />
        ),
        meta: { align: "right" },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">{t.common.actions}</span>,
        cell: ({ row }) => <RowActions label={t.common.actionsFor({ name: row.original.person })} actions={actionsFor(row.original)} />,
        meta: { className: "w-12" },
      },
    ],
    [actionsFor, t],
  );

  return (
    <TabContent>
      <TabToolbar
        actions={
          <Button onClick={openCreate}>
            <Plus />
            {t.loans.add}
          </Button>
        }
      />

      <StatGrid className="xl:grid-cols-3">
        <StatCard
          help="loansOwedToYou"
          label={t.loans.kpi.owedToYou.label}
          icon={ArrowUpRight}
          value={<Money value={owedToYou} compact tone="success" />}
          hint={t.loans.kpi.owedToYou.hint}
        />
        <StatCard help="loansYouOwe" label={t.loans.kpi.youOwe.label} icon={ArrowDownLeft} value={<Money value={youOwe} compact tone="danger" />} hint={t.loans.kpi.youOwe.hint} />
        <StatCard
          help="loansNet"
          label={t.loans.kpi.net.label}
          icon={Scale}
          value={<Money value={owedToYou - youOwe} compact signed tone="auto" />}
          hint={t.loans.kpi.net.hint}
        />
      </StatGrid>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0" aria-hidden />
        {countsInNetWorth ? t.wealth.loans.statusOn : t.wealth.loans.statusOff}
        <Link href="/settings#calculation" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t.wealth.loans.change}
        </Link>
      </p>

      <Section title={t.loans.log.title} description={t.loans.log.description} flush help="loanLog">
        <div className="border-b px-5 py-3">
          <DataTableToolbar search={search} onSearchChange={setSearch} placeholder={t.loans.log.searchPlaceholder}>
            <SegmentedControl<DirectionFilter>
              aria-label={t.loans.log.directionLabel}
              value={direction}
              onValueChange={setDirection}
              options={[
                { value: "all", label: t.loans.log.all },
                { value: "lent_out", label: t.loans.owedToYou },
                { value: "borrowed", label: t.loans.youOwe },
              ]}
            />
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-32" aria-label={t.loans.log.statusLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.loans.log.anyStatus}</SelectItem>
                <SelectItem value="open">{t.loans.open}</SelectItem>
                <SelectItem value="settled">{t.loans.settled}</SelectItem>
              </SelectContent>
            </Select>
          </DataTableToolbar>
        </div>
        <DataTable
          columns={columns}
          data={visible}
          getRowId={(l) => l.id}
          manualSorting={false}
          onRowClick={openEdit}
          empty={
            loans.length === 0 ? (
              <EmptyState
                icon={HandCoins}
                title={t.loans.empty.title}
                description={t.loans.empty.description}
                action={
                  <Button variant="outline" onClick={openCreate}>
                    <Plus />
                    {t.loans.add}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={t.loans.empty.filteredTitle} description={t.loans.empty.filteredDescription} />
            )
          }
          renderMobileItem={(l) => (
            <div className="flex items-center gap-3 px-4 py-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(l)}>
                <p className={l.status === "settled" ? "truncate font-medium text-muted-foreground" : "truncate font-medium"}>{l.person}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.direction === "lent_out" ? t.loans.owedToYou : t.loans.youOwe} · {formatDate(l.date)}
                  {l.status === "settled" ? t.loans.settledSuffix : ""}
                </p>
              </button>
              <Money
                value={l.amount}
                strike={l.status === "settled"}
                tone={l.status === "settled" ? "muted" : l.direction === "lent_out" ? "success" : "danger"}
                className="text-sm font-medium"
              />
              <RowActions label={t.common.actionsFor({ name: l.person })} actions={actionsFor(l)} />
            </div>
          )}
        />
      </Section>

      <LoanFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialog?.mode ?? "create"}
        loan={dialog?.loan ?? null}
        onSubmit={(draft) => {
          const next = sanitizePersonalLoan(draft);
          if (dialog?.mode === "edit") {
            setLoans((prev) => prev.map((l) => (l.id === next.id ? next : l)));
            toast.success(t.loans.toast.updated);
          } else {
            setLoans((prev) => [...prev, next]);
            toast.success(t.loans.toast.added);
          }
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t.loans.confirmDelete.title}
        description={
          pendingDelete ? t.loans.confirmDelete.description({ amount: formatMoney(pendingDelete.amount), person: pendingDelete.person }) : null
        }
        onConfirm={() => {
          if (!pendingDelete) return;
          const removed = pendingDelete;
          setLoans((prev) => prev.filter((l) => l.id !== removed.id));
          toast.success(t.loans.toast.deleted, { description: removed.person });
        }}
      />
    </TabContent>
  );
}
