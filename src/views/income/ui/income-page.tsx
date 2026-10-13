"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Briefcase, PiggyBank, Plus, Receipt, Trash2, Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { buildGoalStartingOptions } from "@/entities/goal";
import {
  createIncomeSourceDraft,
  INCOME_SOURCES_SEED,
  capitalYieldPct,
  effectiveIncomeCapital,
  incomeCapitalPeers,
  sanitizeIncomeSource,
  totalCapitalAmount,
  type IncomeSource,
} from "@/entities/income";
import { useHouseholdCashflow } from "@/entities/portfolio/model/use-household-cashflow";
import { applyAverageMonthlySpending, PREFERENCES_SEED } from "@/entities/preferences";
import { SETTINGS_ASSETS_SEED } from "@/entities/settings-asset";
import { useI18n, type Messages } from "@/shared/i18n";
import { formatPercent } from "@/shared/lib/format";
import { useCreateParam } from "@/shared/lib/use-create-param";
import { useTable } from "@/shared/storage";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { DataTable, DataTableColumnHeader, RowActions, type RowAction } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { RegistryIcon } from "@/shared/ui/icon-registry";
import { Button } from "@/shared/ui/kit/button";
import { Money } from "@/shared/ui/money";
import { PageHeader } from "@/shared/ui/page-header";
import { Section } from "@/shared/ui/section";
import { StatusBadge } from "@/shared/ui/status-badge";
import { PageContainer } from "@/widgets/app-shell";

import { IncomeSourceFormDialog } from "./income-source-form-dialog";
import { CashFlowPanel } from "./cash-flow-panel";

type DialogState = { mode: "create" | "edit"; source: IncomeSource };

function KindBadge({ kind }: { kind: IncomeSource["kind"] }) {
  const { t } = useI18n();
  return kind === "active" ? (
    <StatusBadge icon={Briefcase}>{t.income.active}</StatusBadge>
  ) : (
    <StatusBadge tone="info" icon={PiggyBank}>
      {t.income.passive}
    </StatusBadge>
  );
}

function paymentLabel(t: Messages, s: IncomeSource): string {
  const parts = [s.paymentDay ? t.income.paymentDay({ day: s.paymentDay }) : null, s.paymentEntity || null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export function IncomePage() {
  const { t } = useI18n();
  const [sources, setSources] = useTable("incomeSources", INCOME_SOURCES_SEED);
  const [, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [settingsAssets] = useTable("settingsAssets", SETTINGS_ASSETS_SEED);

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<IncomeSource | null>(null);

  const cash = useHouseholdCashflow();
  const seedOptions = useMemo(() => buildGoalStartingOptions(assets, settingsAssets), [assets, settingsAssets]);
  const peers = useMemo(() => (dialog ? incomeCapitalPeers(sources, dialog.source.id) : []), [sources, dialog]);

  const openCreate = useCallback(() => {
    setDialog({ mode: "create", source: createIncomeSourceDraft() });
    setDialogOpen(true);
  }, []);
  const openEdit = useCallback((s: IncomeSource) => {
    setDialog({ mode: "edit", source: { ...s, capitalLines: [...(s.capitalLines ?? [])] } });
    setDialogOpen(true);
  }, []);
  useCreateParam(openCreate, (id) => {
    const s = sources.find((x) => x.id === id);
    if (s) openEdit(s);
  });

  const actionsFor = useCallback(
    (s: IncomeSource): RowAction[] => [
      { label: t.common.edit, icon: Pencil, onSelect: () => openEdit(s) },
      "separator",
      { label: t.common.delete, icon: Trash2, destructive: true, onSelect: () => setPendingDelete(s) },
    ],
    [openEdit, t],
  );

  const columns = useMemo<ColumnDef<IncomeSource>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.income.columns.source} />,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <RegistryIcon name={row.original.icon} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              {row.original.details ? <p className="truncate text-xs text-muted-foreground">{row.original.details}</p> : null}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "kind",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.income.columns.type} />,
        cell: ({ row }) => <KindBadge kind={row.original.kind} />,
      },
      {
        id: "payment",
        header: t.income.columns.payment,
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-foreground">{paymentLabel(t, row.original)}</span>,
        meta: { className: "hidden xl:table-cell" },
      },
      {
        id: "capital",
        header: t.income.columns.capital,
        accessorFn: (s) => effectiveIncomeCapital(s, sources, seedOptions),
        cell: ({ row }) => {
          const reserved = totalCapitalAmount(row.original.capitalLines);
          const capital = effectiveIncomeCapital(row.original, sources, seedOptions);
          const yieldPct = capitalYieldPct(row.original.monthly, capital);
          return reserved > 0 ? (
            <div>
              <Money value={capital} />
              <p className="text-xs text-muted-foreground">
                {yieldPct !== null ? t.income.capital.yield({ pct: formatPercent(yieldPct) }) : t.income.capital.noYield}
                {capital < reserved ? (
                  <>
                    {t.income.capital.ofPrefix}
                    <Money value={reserved} />
                    {t.income.capital.reservedSuffix}
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        meta: { align: "right", className: "hidden xl:table-cell" },
      },
      {
        accessorKey: "monthly",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.income.columns.monthly} align="right" />,
        cell: ({ row }) => <Money value={row.original.monthly} className="font-medium" />,
        footer: () => <Money value={cash.totalIncome} className="font-semibold" />,
        meta: { align: "right" },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">{t.common.actions}</span>,
        cell: ({ row }) => <RowActions label={t.common.actionsFor({ name: row.original.name })} actions={actionsFor(row.original)} />,
        meta: { className: "w-12" },
      },
    ],
    [actionsFor, cash.totalIncome, sources, seedOptions, t],
  );

  return (
    <PageContainer>
      <PageHeader
        title={t.income.title}
        description={t.income.description}
        actions={
          <Button onClick={openCreate}>
            <Plus />
            {t.income.addSource}
          </Button>
        }
      />

      <CashFlowPanel
        cash={cash}
        sourceCount={sources.length}
        onAddSource={openCreate}
        onSaveSpending={(amount) => {
          setPrefs((p) => applyAverageMonthlySpending(p, amount));
          toast.success(t.income.toast.spendingSaved);
        }}
      />

      <Section title={t.income.sourcesTitle} description={t.common.sources({ count: sources.length })} flush>
        <DataTable
          columns={columns}
          data={sources}
          getRowId={(s) => s.id}
          onRowClick={openEdit}
          empty={
            <EmptyState
              icon={Receipt}
              title={t.income.empty.title}
              description={t.income.empty.description}
              action={
                <Button variant="outline" onClick={openCreate}>
                  <Plus />
                  {t.income.addSource}
                </Button>
              }
            />
          }
          renderMobileItem={(s) => (
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <RegistryIcon name={s.icon} />
              </span>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(s)}>
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.kind === "active" ? t.income.active : t.income.passive} · {paymentLabel(t, s)}
                </p>
              </button>
              <Money value={s.monthly} className="text-sm font-medium" />
              <RowActions label={t.common.actionsFor({ name: s.name })} actions={actionsFor(s)} />
            </div>
          )}
        />
      </Section>

      <IncomeSourceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialog?.mode ?? "create"}
        source={dialog?.source ?? null}
        peers={peers}
        seedOptions={seedOptions}
        onSubmit={(draft) => {
          const next = sanitizeIncomeSource(draft);
          if (dialog?.mode === "edit") {
            setSources((prev) => prev.map((s) => (s.id === next.id ? next : s)));
            toast.success(t.income.toast.updated);
          } else {
            setSources((prev) => [...prev, next]);
            toast.success(t.income.toast.added);
          }
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t.income.confirmDelete.title}
        description={pendingDelete ? t.income.confirmDelete.description({ name: pendingDelete.name }) : null}
        onConfirm={() => {
          if (!pendingDelete) return;
          const removed = pendingDelete;
          setSources((prev) => prev.filter((s) => s.id !== removed.id));
          toast.success(t.income.toast.deleted, { description: removed.name });
        }}
      />
    </PageContainer>
  );
}
